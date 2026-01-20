package com.anonymous.JINI;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class CallModule extends ReactContextBaseJavaModule {

    private ReactApplicationContext context;

    public CallModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;
    }

    @Override
    public String getName() {
        return "CallModule";
    }

    public void sendRecordingSavedEvent() {
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onRecordingSaved", null);
    }
}
