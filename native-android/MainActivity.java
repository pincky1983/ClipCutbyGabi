package com.gabi.clipcut;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClipCutNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
