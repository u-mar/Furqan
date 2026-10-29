package com.qurannaba.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins, registered before the bridge starts.
        registerPlugin(NabaBarsPlugin.class);
        registerPlugin(NabaGooglePlugin.class);
        registerPlugin(NabaSpeechPlugin.class);
        registerPlugin(NabaSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
