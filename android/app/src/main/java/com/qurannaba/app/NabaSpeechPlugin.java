package com.qurannaba.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Voice search inside the app. Android's WebView has no speech recognition of its own, so the
 * phone's is used (the same one as the keyboard's mic, Google's on most phones). The site calls
 * it from hooks/useArabicVoiceInput.ts and hears back through two events: "partial", the words so
 * far, while the person speaks; and "end", everything heard, once they stop.
 *
 * Android's recognizer stops at the first pause, but a reciter pauses between words: until the
 * person taps stop, each stretch is added on and it listens again. It ends by itself only when
 * nothing at all is heard for a while.
 */
@CapacitorPlugin(name = "NabaSpeech", permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }))
public class NabaSpeechPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private boolean listening = false;
    private String heard = "";
    private String lang = "ar-SA";

    /** Some recognizers say nothing more once stopped with nothing heard: end it anyway. */
    private final Runnable giveUp = () -> finish(true);

    @PluginMethod
    public void start(PluginCall call) {
        lang = call.getString("lang", "ar-SA");
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneAnswered");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void microphoneAnswered(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else call.reject("Microphone not allowed", "denied");
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (recognizer == null) return;
            listening = false;
            // What was said so far still comes in (onResults), and then it ends.
            recognizer.stopListening();
            main.postDelayed(giveUp, 2000);
        });
        call.resolve();
    }

    private void begin(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("No speech recognition on this phone", "unavailable");
            return;
        }
        main.post(() -> {
            finish(false);
            heard = "";
            listening = true;
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(listener);
            listen();
            call.resolve();
        });
    }

    private void listen() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        recognizer.startListening(intent);
    }

    /** Ends the session, telling the site what was heard unless a new one is replacing it. */
    private void finish(boolean tell) {
        main.removeCallbacks(giveUp);
        listening = false;
        if (recognizer == null) return;
        recognizer.destroy();
        recognizer = null;
        if (tell) emit("end", heard);
    }

    private void emit(String event, String text) {
        JSObject data = new JSObject();
        data.put("text", text);
        notifyListeners(event, data);
    }

    private static String best(Bundle results) {
        ArrayList<String> texts = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return texts == null || texts.isEmpty() || texts.get(0) == null ? "" : texts.get(0).trim();
    }

    private static String join(String before, String more) {
        if (before.isEmpty()) return more;
        return more.isEmpty() ? before : before + " " + more;
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override
        public void onPartialResults(Bundle partial) {
            String text = best(partial);
            if (!text.isEmpty()) emit("partial", join(heard, text));
        }

        @Override
        public void onResults(Bundle results) {
            heard = join(heard, best(results));
            if (!heard.isEmpty()) emit("partial", heard);
            if (listening) listen();
            else finish(true);
        }

        @Override
        public void onError(int error) {
            // Nothing heard for a while (or the stop came before any words), the network, or the
            // recognizer itself: either way, end with what was heard.
            finish(true);
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onEvent(int eventType, Bundle params) {}
    };

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // Leaving the app stops listening, as the phone's own mic button does.
        main.post(() -> finish(true));
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        main.post(() -> finish(false));
    }
}
