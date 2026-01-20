package com.anonymous.JINI;

import android.database.Cursor;
import android.provider.CallLog;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class CallLogModule extends ReactContextBaseJavaModule {

    public CallLogModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "CallLogModule";
    }

    @ReactMethod
    public void getCallLogs(Promise promise) {
        try {
            WritableArray result = Arguments.createArray();

            Cursor cursor = getReactApplicationContext().getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                null, null, null,
                CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap log = Arguments.createMap();
                    log.putString("name", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)));
                    log.putString("number", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)));
                    log.putString("type", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)));
                    log.putString("duration", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)));
                    log.putString("date", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)));

                    result.pushMap(log);
                }
                cursor.close();
            }

            promise.resolve(result);

        } catch (Exception e) {
            promise.reject("ERROR_GET_CALL_LOGS", e.getMessage());
        }
    }
}
