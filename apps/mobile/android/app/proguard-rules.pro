# Release builds shrink code with R8. Keep the face detection (ML Kit) and the
# face model runtime (TensorFlow Lite): R8 cannot see they are used through
# reflection and native code, and removing them crashes face analysis.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_face.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_common.** { *; }
-keep class com.google_mlkit_commons.** { *; }
-keep class com.google_mlkit_face_detection.** { *; }
-dontwarn com.google.mlkit.**
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.lite.**
