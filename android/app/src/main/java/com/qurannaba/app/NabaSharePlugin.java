package com.qurannaba.app;

import android.Manifest;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Sharing and saving inside the app. Android's WebView has neither the phone's share sheet
 * (navigator.share) nor downloads, so the site hands the file over here instead
 * (components/NativeShare.tsx): in pieces, since the bridge only carries text, into the app's
 * cache; then it goes to the share sheet, or into the phone's gallery, in a "Naba" folder
 * (Movies, Pictures or Music by kind; anything else in Download).
 */
@CapacitorPlugin(
    name = "NabaShare",
    // Only Android 9 and older ask before the app may save into the gallery.
    permissions = @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
)
public class NabaSharePlugin extends Plugin {

    /** Handed-over files older than this are cleared away: whoever they were shared with has them by now. */
    private static final long KEEP_MS = 60 * 60 * 1000;

    /** One piece of a file the site is handing over, as base64; the first piece starts the file afresh. */
    @PluginMethod
    public void write(PluginCall call) {
        boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        if (!append) clearOld();
        try (FileOutputStream out = new FileOutputStream(handedOver(call.getString("name")), append)) {
            out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not take the file", "failed", e);
        }
    }

    /** The phone's share sheet, with a handed-over file (`name`), some text, or both. */
    @PluginMethod
    public void share(PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        Intent send = new Intent(Intent.ACTION_SEND);
        if (name != null) {
            File file = handedOver(name);
            if (!file.exists()) {
                call.reject("No such file", "failed");
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            send.setType(call.getString("mime", "application/octet-stream"));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri(file.getName(), uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            send.setType("text/plain");
        }
        if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
        String title = call.getString("title");
        if (title != null) send.putExtra(Intent.EXTRA_SUBJECT, title);
        Intent chooser = Intent.createChooser(send, null);
        getActivity().runOnUiThread(() -> {
            getActivity().startActivity(chooser);
            call.resolve();
        });
    }

    /** Puts a handed-over file in the phone's gallery (or Download), where other apps can pick it up. */
    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storageAnswered");
            return;
        }
        saveFile(call);
    }

    @PermissionCallback
    private void storageAnswered(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) saveFile(call);
        else call.reject("Storage not allowed", "denied");
    }

    private void saveFile(PluginCall call) {
        File file = handedOver(call.getString("name"));
        String mime = call.getString("mime", "application/octet-stream");
        String folder = mime.startsWith("video/")
            ? Environment.DIRECTORY_MOVIES
            : mime.startsWith("image/")
                ? Environment.DIRECTORY_PICTURES
                : mime.startsWith("audio/") ? Environment.DIRECTORY_MUSIC : Environment.DIRECTORY_DOWNLOADS;
        try {
            if (!file.exists()) throw new IOException("No such file");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) saveToMediaStore(file, mime, folder);
            else saveToFolder(file, mime, folder);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not save the file", "failed", e);
        }
    }

    /** Android 10 and newer: no permission needed; a name already there gets " (1)" added. */
    private void saveToMediaStore(File file, String mime, String folder) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, file.getName());
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, folder + "/Naba");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri item = resolver.insert(collection(mime), values);
        if (item == null) throw new IOException("No room in the gallery");
        try (InputStream in = new FileInputStream(file); OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IOException("Gallery would not open");
            copy(in, out);
        } catch (IOException e) {
            resolver.delete(item, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(item, values, null, null);
    }

    private static Uri collection(String mime) {
        String volume = MediaStore.VOLUME_EXTERNAL_PRIMARY;
        if (mime.startsWith("video/")) return MediaStore.Video.Media.getContentUri(volume);
        if (mime.startsWith("image/")) return MediaStore.Images.Media.getContentUri(volume);
        if (mime.startsWith("audio/")) return MediaStore.Audio.Media.getContentUri(volume);
        return MediaStore.Downloads.getContentUri(volume);
    }

    /** Android 9 and older: straight into the folder, then the gallery is told it is there. */
    @SuppressWarnings("deprecation")
    private void saveToFolder(File file, String mime, String folder) throws IOException {
        File dir = new File(Environment.getExternalStoragePublicDirectory(folder), "Naba");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Could not make the folder");
        String name = file.getName();
        int dot = name.lastIndexOf('.');
        String stem = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        File target = new File(dir, name);
        for (int n = 1; target.exists(); n++) target = new File(dir, stem + " (" + n + ")" + ext);
        try (InputStream in = new FileInputStream(file); OutputStream out = new FileOutputStream(target)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { target.getAbsolutePath() }, new String[] { mime }, null);
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        for (int read; (read = in.read(buffer)) > 0; ) out.write(buffer, 0, read);
    }

    /** Where a handed-over file lives: the app's cache, which the share sheet can read (res/xml/file_paths.xml). */
    private File handedOver(String name) {
        File dir = new File(getContext().getCacheDir(), "shared");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        String safe = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (safe.isEmpty() || safe.startsWith(".")) safe = "naba" + safe;
        if (safe.length() > 120) safe = safe.substring(safe.length() - 120);
        return new File(dir, safe);
    }

    private void clearOld() {
        File[] files = new File(getContext().getCacheDir(), "shared").listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - KEEP_MS;
        for (File file : files) {
            //noinspection ResultOfMethodCallIgnored
            if (file.lastModified() < cutoff) file.delete();
        }
    }
}
