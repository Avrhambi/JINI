// package com.anonymous.JINI;

// import android.content.pm.PackageManager;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.ReactContextBaseJavaModule;
// import com.facebook.react.bridge.ReactMethod;
// import com.facebook.react.bridge.Promise;

// import java.io.BufferedReader;
// import java.io.InputStreamReader;

// import rikka.shizuku.Shizuku;
// import rikka.shizuku.SystemServiceHelper;

// public class ShizukuModule extends ReactContextBaseJavaModule {

//     public ShizukuModule(ReactApplicationContext reactContext) {
//         super(reactContext);
//     }

//     @Override
//     public String getName() {
//         return "ShizukuModule";
//     }

//     // Check if Shizuku is running and accessible
//     @ReactMethod
//     public void isShizukuAvailable(Promise promise) {
//         try {
//             boolean available = Shizuku.pingBinder();
//             promise.resolve(available);
//         } catch (Exception e) {
//             promise.resolve(false);
//         }
//     }

//     // Request permission to use Shizuku
//     @ReactMethod
//     public void requestPermission(Promise promise) {
//         try {
//             if (Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED) {
//                 promise.resolve(true);
//             } else {
//                 Shizuku.requestPermission(0);
//                 promise.resolve(false);
//             }
//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }

//     // List call recordings using the shell via Shizuku binder
//     @ReactMethod
//     public void listRecordings(Promise promise) {
//         try {
//             String path = "/data/user/0/com.google.android.dialer/files/callrecording";
//             String[] cmd = new String[] { "sh", "-c", "ls -la " + path };

//             Process process = Shizuku.newProcess(cmd, null, null);

//             BufferedReader reader = new BufferedReader(
//                     new InputStreamReader(process.getInputStream()));
//             StringBuilder output = new StringBuilder();
//             String line;

//             while ((line = reader.readLine()) != null) {
//                 output.append(line).append("\n");
//             }

//             process.waitFor();
//             promise.resolve(output.toString());

//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }

//     // Copy a recording using the shell via Shizuku binder
//     @ReactMethod
//     public void copyRecording(String fileName, String destination, Promise promise) {
//         try {
//             String source = "/data/user/0/com.google.android.dialer/files/callrecording/" + fileName;
//             String command = "cp " + source + " " + destination;
//             String[] cmd = new String[] { "sh", "-c", command };

//             Process process = Shizuku.newProcess(cmd, null, null);
//             process.waitFor();

//             if (process.exitValue() == 0) {
//                 promise.resolve(true);
//             } else {
//                 promise.reject("ERROR", "Failed to copy file");
//             }

//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }
// }


// package com.anonymous.JINI;

// import android.content.pm.PackageManager;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.ReactContextBaseJavaModule;
// import com.facebook.react.bridge.ReactMethod;
// import com.facebook.react.bridge.Promise;

// import java.io.BufferedReader;
// import java.io.InputStreamReader;
// import java.io.IOException;

// import android.os.ParcelFileDescriptor;

// import rikka.shizuku.Shizuku;

// public class ShizukuModule extends ReactContextBaseJavaModule {

//     public ShizukuModule(ReactApplicationContext reactContext) {
//         super(reactContext);
//     }

//     @Override
//     public String getName() {
//         return "ShizukuModule";
//     }

//     // Helper method: runs a shell command through Shizuku
//     private Process execViaShizuku(String[] cmd) throws IOException {
//         // Build a command that runs via /system/bin/sh
//         ProcessBuilder builder = new ProcessBuilder(cmd);
//         builder.redirectErrorStream(true);
//         return builder.start();
//     }

//     // Check if Shizuku is running and accessible
//     @ReactMethod
//     public void isShizukuAvailable(Promise promise) {
//         try {
//             boolean available = Shizuku.pingBinder();
//             promise.resolve(available);
//         } catch (Exception e) {
//             promise.resolve(false);
//         }
//     }

//     // Request permission to use Shizuku
//     @ReactMethod
//     public void requestPermission(Promise promise) {
//         try {
//             if (Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED) {
//                 promise.resolve(true);
//             } else {
//                 Shizuku.requestPermission(0);
//                 promise.resolve(false);
//             }
//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }

//     // List call recordings using a shell via Shizuku
//     @ReactMethod
//     public void listRecordings(Promise promise) {
//         try {
//             String path = "/data/user/0/com.google.android.dialer/files/callrecording";
//             String[] cmd = new String[] { "sh", "-c", "ls -la " + path };

//             Process process = execViaShizuku(cmd);

//             BufferedReader reader = new BufferedReader(
//                     new InputStreamReader(process.getInputStream()));
//             StringBuilder output = new StringBuilder();
//             String line;

//             while ((line = reader.readLine()) != null) {
//                 output.append(line).append("\n");
//             }

//             process.waitFor();
//             promise.resolve(output.toString());

//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }

//     // Copy a recording using a shell via Shizuku
//     @ReactMethod
//     public void copyRecording(String fileName, String destination, Promise promise) {
//         try {
//             String source = "/data/user/0/com.google.android.dialer/files/callrecording/" + fileName;
//             String command = "cp " + source + " " + destination;
//             String[] cmd = new String[] { "sh", "-c", command };

//             Process process = execViaShizuku(cmd);
//             process.waitFor();

//             if (process.exitValue() == 0) {
//                 promise.resolve(true);
//             } else {
//                 promise.reject("ERROR", "Failed to copy file");
//             }

//         } catch (Exception e) {
//             promise.reject("ERROR", e.getMessage());
//         }
//     }
// }

package com.anonymous.JINI;

import android.content.pm.PackageManager;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;

import rikka.shizuku.Shizuku;
import rikka.shizuku.Shizuku.OnRequestPermissionResultListener;

public class ShizukuModule extends ReactContextBaseJavaModule {

    private static final String TAG = "ShizukuModule";
    private final ReactApplicationContext reactContext;

    private final OnRequestPermissionResultListener permissionListener =
            (requestCode, grantResult) -> {
                Log.i(TAG, "Permission result: " + grantResult);
            };

    public ShizukuModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;

        // Register listeners for Shizuku binder
        Shizuku.addBinderReceivedListener(() -> {
            Log.i(TAG, "Shizuku binder received!");
        });

        Shizuku.addBinderDeadListener(() -> {
            Log.w(TAG, "Shizuku binder dead.");
        });

        Shizuku.addRequestPermissionResultListener(permissionListener);
    }

    @Override
    public String getName() {
        return "ShizukuModule";
    }

    // -----------------------------
    // Internal Helper
    // -----------------------------
    private Process execViaShizuku(String[] cmd) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(cmd);
        builder.redirectErrorStream(true);
        return builder.start();
    }

    // -----------------------------
    // React Methods
    // -----------------------------

    // Check if Shizuku is available
    @ReactMethod
    public void isShizukuAvailable(Promise promise) {
        try {
            boolean available = Shizuku.pingBinder();
            Log.i(TAG, "isShizukuAvailable: " + available);
            promise.resolve(available);
        } catch (Exception e) {
            Log.e(TAG, "isShizukuAvailable error", e);
            promise.resolve(false);
        }
    }

    // Request Shizuku permission safely
    @ReactMethod
    public void requestPermission(Promise promise) {
        try {
            if (!Shizuku.pingBinder()) {
                Log.e(TAG, "Binder not received yet!");
                promise.reject("BINDER_NOT_READY", "binder haven't been received");
                return;
            }

            int permission = Shizuku.checkSelfPermission();
            Log.i(TAG, "checkSelfPermission: " + permission);

            if (permission == PackageManager.PERMISSION_GRANTED) {
                promise.resolve(true);
                return;
            }

            if (Shizuku.shouldShowRequestPermissionRationale()) {
                Log.w(TAG, "Permission rationale should be shown.");
            }

            // Request permission
            Shizuku.requestPermission(100);
            promise.resolve(false);

        } catch (Exception e) {
            Log.e(TAG, "requestPermission error", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    // List recordings via shell
    @ReactMethod
    public void listRecordings(Promise promise) {
        try {
            if (!Shizuku.pingBinder()) {
                promise.reject("BINDER_NOT_READY", "Shizuku binder not ready");
                return;
            }

            String path = "/data/user/0/com.google.android.dialer/files/callrecording";
            String[] cmd = new String[]{"sh", "-c", "ls -la " + path};
            Process process = execViaShizuku(cmd);

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }

            process.waitFor();
            promise.resolve(output.toString());
        } catch (Exception e) {
            Log.e(TAG, "listRecordings error", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    // Copy recording file via shell
    @ReactMethod
    public void copyRecording(String fileName, String destination, Promise promise) {
        try {
            if (!Shizuku.pingBinder()) {
                promise.reject("BINDER_NOT_READY", "Shizuku binder not ready");
                return;
            }

            String source = "/data/user/0/com.google.android.dialer/files/callrecording/" + fileName;
            String command = "cp " + source + " " + destination;
            String[] cmd = new String[]{"sh", "-c", command};

            Process process = execViaShizuku(cmd);
            process.waitFor();

            if (process.exitValue() == 0) {
                promise.resolve(true);
            } else {
                promise.reject("ERROR", "Failed to copy file");
            }
        } catch (Exception e) {
            Log.e(TAG, "copyRecording error", e);
            promise.reject("ERROR", e.getMessage());
        }
    }
}
