package com.qurannaba.app;

import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * "Continue with Google" inside the app. Google does not allow its sign-in page in an app's
 * WebView, so the phone's own account picker is shown instead (Credential Manager). It hands back
 * a Google ID token made out to the site's web client (the clientId the site passes), which the
 * site's server checks exactly as it does one from the website (lib/google-auth.ts).
 *
 * Google recognises the app by its package name and signing key: each key that signs it needs an
 * "Android" OAuth client in Google Cloud, in the same project as the web client.
 */
@CapacitorPlugin(name = "NabaGoogle")
public class NabaGooglePlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId.isEmpty()) {
            call.reject("No client id", "unavailable");
            return;
        }
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
            .build();
        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (
                        !(credential instanceof CustomCredential) ||
                        !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())
                    ) {
                        call.reject("Not a Google credential", "failed");
                        return;
                    }
                    try {
                        JSObject result = new JSObject();
                        result.put("idToken", GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken());
                        call.resolve(result);
                    } catch (Exception e) {
                        call.reject("Unreadable Google credential", "failed", e);
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    // Closing the account picker is a choice, not an error worth a message.
                    boolean cancelled = e instanceof GetCredentialCancellationException;
                    call.reject(String.valueOf(e.getMessage()), cancelled ? "cancelled" : "failed", e);
                }
            }
        );
    }
}
