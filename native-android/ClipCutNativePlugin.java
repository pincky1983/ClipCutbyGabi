package com.gabi.clipcut;

import android.net.Uri;
import android.os.Environment;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.ScaleAndRotateTransformation;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.effect.TextOverlay;
import java.io.FileOutputStream;

import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "ClipCutNative")
@OptIn(markerClass = UnstableApi.class)
public class ClipCutNativePlugin extends Plugin {

    private File prepareOutputFile(String subFolder, String fileName) {
        File docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
        File targetDir = new File(docsDir, "ClipCut/" + (subFolder != null && !subFolder.isEmpty() ? subFolder : "ClipCut"));
        if (!targetDir.exists()) targetDir.mkdirs();
        File outFile = new File(targetDir, fileName);
        if (outFile.exists()) outFile.delete();
        return outFile;
    }

    private void runTransformer(Composition composition, File outFile, PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Transformer transformer = new Transformer.Builder(getContext())
                .addListener(new Transformer.Listener() {
                    @Override
                    public void onCompleted(Composition comp, ExportResult result) {
                        JSObject ret = new JSObject();
                        ret.put("path", outFile.getAbsolutePath());
                        call.resolve(ret);
                    }
                    @Override
                    public void onError(Composition comp, ExportResult result, ExportException e) {
                        call.reject("Eroare procesare nativa: " + e.getMessage());
                    }
                })
                .build();
            transformer.start(composition, outFile.getAbsolutePath());
        });
    }

    // TAB 1: TAIE (MP4 sau MP3/M4A)
    @PluginMethod
    public void cutMedia(PluginCall call) {
        String inputPath = call.getString("inputPath");
        long startMs = call.getLong("startMs", 0L);
        long endMs = call.getLong("endMs", 0L);
        String outName = call.getString("outputName");
        String subFolder = call.getString("subFolder");

        File outFile = prepareOutputFile(subFolder, outName);
        MediaItem mediaItem = new MediaItem.Builder()
            .setUri(Uri.fromFile(new File(inputPath)))
            .setClippingConfiguration(
                new MediaItem.ClippingConfiguration.Builder()
                    .setStartPositionMs(startMs)
                    .setEndPositionMs(endMs)
                    .build()
            )
            .build();

        EditedMediaItem editedItem = new EditedMediaItem.Builder(mediaItem).build();
        Composition composition = new Composition.Builder(
            new EditedMediaItemSequence(Collections.singletonList(editedItem))
        ).build();

        runTransformer(composition, outFile, call);
    }
    // TAB 2: LIPESTE (2 fisiere video sau audio)
    @PluginMethod
    public void mergeMedia(PluginCall call) {
        String path1 = call.getString("path1");
        String path2 = call.getString("path2");
        String outName = call.getString("outputName");
        String subFolder = call.getString("subFolder");

        File outFile = prepareOutputFile(subFolder, outName);
        List<EditedMediaItem> items = new ArrayList<>();
        items.add(new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(path1)))).build());
        items.add(new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(path2)))).build());

        Composition composition = new Composition.Builder(
            new EditedMediaItemSequence(items)
        ).build();

        runTransformer(composition, outFile, call);
    }

    // TAB 3: EXTRAGE AUDIO (din video)
    @PluginMethod
    public void extractAudio(PluginCall call) {
        String inputPath = call.getString("inputPath");
        String outName = call.getString("outputName");
        String subFolder = call.getString("subFolder");

        File outFile = prepareOutputFile(subFolder, outName);
        EditedMediaItem editedItem = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(inputPath))))
            .setRemoveVideo(true)
            .build();

        Composition composition = new Composition.Builder(
            new EditedMediaItemSequence(Collections.singletonList(editedItem))
        ).build();

        runTransformer(composition, outFile, call);
    }

    // TAB 4: COMBINA VIDEO + AUDIO
    @PluginMethod
    public void muxVideoAudio(PluginCall call) {
        String videoPath = call.getString("videoPath");
        String audioPath = call.getString("audioPath");
        String outName = call.getString("outputName");
        String subFolder = call.getString("subFolder");

        File outFile = prepareOutputFile(subFolder, outName);

        EditedMediaItem videoItem = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(videoPath))))
            .setRemoveAudio(true)
            .build();
        EditedMediaItem audioItem = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(audioPath))))
            .setRemoveVideo(true)
            .build();

        List<EditedMediaItemSequence> sequences = new ArrayList<>();
        sequences.add(new EditedMediaItemSequence(Collections.singletonList(videoItem)));
        sequences.add(new EditedMediaItemSequence(Collections.singletonList(audioItem)));

        Composition composition = new Composition.Builder(sequences).build();
        runTransformer(composition, outFile, call);
    }
    // TAB 5: SLIDESHOW NATIV DIN POZE + MUZICA
    @PluginMethod
    public void createSlideshow(PluginCall call) {
        try {
            JSArray imagePaths = call.getArray("imagePaths");
            String audioPath = call.getString("audioPath");
            long durationPerPhotoMs = call.getLong("durationPerPhotoMs", 3000L);
            String outName = call.getString("outputName");
            String subFolder = call.getString("subFolder");

            File outFile = prepareOutputFile(subFolder, outName);
            List<EditedMediaItem> imageItems = new ArrayList<>();
            long totalDurationUs = 0;

            for (int i = 0; i < imagePaths.length(); i++) {
                String imgPath = imagePaths.getString(i);
                MediaItem imgItem = new MediaItem.Builder()
                    .setUri(Uri.fromFile(new File(imgPath)))
                    .setImageDurationMs(durationPerPhotoMs)
                    .build();

                float zoomScale = (i % 2 == 0) ? 1.12f : 1.04f;
                ScaleAndRotateTransformation zoomEffect = new ScaleAndRotateTransformation.Builder()
                    .setScale(zoomScale, zoomScale)
                    .build();

                EditedMediaItem editedImg = new EditedMediaItem.Builder(imgItem)
                    .setFrameRate(24)
                    .setEffects(new Effects(Collections.emptyList(), Collections.singletonList(zoomEffect)))
                    .build();

                imageItems.add(editedImg);
                totalDurationUs += durationPerPhotoMs * 1000L;
            }

            List<EditedMediaItemSequence> sequences = new ArrayList<>();
            sequences.add(new EditedMediaItemSequence(imageItems));

            if (audioPath != null && !audioPath.isEmpty()) {
                MediaItem audioItem = new MediaItem.Builder()
                    .setUri(Uri.fromFile(new File(audioPath)))
                    .setClippingConfiguration(
                        new MediaItem.ClippingConfiguration.Builder()
                            .setStartPositionMs(0)
                            .setEndPositionMs(totalDurationUs / 1000L)
                            .build()
                    )
                    .build();
                EditedMediaItem editedAudio = new EditedMediaItem.Builder(audioItem)
                    .setRemoveVideo(true)
                    .build();
                sequences.add(new EditedMediaItemSequence(Collections.singletonList(editedAudio)));
            }

            Composition composition = new Composition.Builder(sequences).build();
            runTransformer(composition, outFile, call);
        } catch (Exception e) {
            call.reject("Eroare pregatire slideshow: " + e.getMessage());
        }
    }
        // TAB 6: KARAOKE NATIV CU VERSURI SINCRONIZATE
    @PluginMethod
    public void createKaraoke(PluginCall call) {
        try {
            String audioPath = call.getString("audioPath");
            String bgPath = call.getString("bgPath");
            long totalDurationMs = call.getLong("totalDurationMs", 10000L);
            JSArray lyricsArr = call.getArray("lyrics");
            String outName = call.getString("outputName");
            String subFolder = call.getString("subFolder");

            File outFile = prepareOutputFile(subFolder, outName);

            // Dacă nu există poză de fundal, creăm una neagră 1280x720 în cache
            if (bgPath == null || bgPath.isEmpty()) {
                File blackBg = new File(getContext().getCacheDir(), "karaoke_black_bg.jpg");
                Bitmap bmp = Bitmap.createBitmap(1280, 720, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bmp);
                canvas.drawColor(Color.BLACK);
                try (FileOutputStream fos = new FileOutputStream(blackBg)) {
                    bmp.compress(Bitmap.CompressFormat.JPEG, 90, fos);
                }
                bmp.recycle();
                bgPath = blackBg.getAbsolutePath();
            }

            List<EditedMediaItem> videoItems = new ArrayList<>();
            long cursorMs = 0L;

            for (int i = 0; i < lyricsArr.length(); i++) {
                org.json.JSONObject line = lyricsArr.getJSONObject(i);
                long startMs = line.getLong("startMs");
                long endMs = line.getLong("endMs");
                String text = line.getString("text");

                // Segment fără versuri (pauză) înainte de vers
                if (startMs > cursorMs) {
                    MediaItem pauseItem = new MediaItem.Builder()
                        .setUri(Uri.fromFile(new File(bgPath)))
                        .setImageDurationMs(startMs - cursorMs)
                        .build();
                    videoItems.add(new EditedMediaItem.Builder(pauseItem).setFrameRate(24).build());
                }

                // Segment cu versul afișat pe ecran
                long lineDur = Math.max(500L, endMs - startMs);
                MediaItem textItem = new MediaItem.Builder()
                    .setUri(Uri.fromFile(new File(bgPath)))
                    .setImageDurationMs(lineDur)
                    .build();

                SpannableString spanText = new SpannableString(text);
                spanText.setSpan(new ForegroundColorSpan(Color.WHITE), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                spanText.setSpan(new RelativeSizeSpan(1.4f), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

                TextOverlay overlay = TextOverlay.createStaticTextOverlay(spanText);
                OverlayEffect effect = new OverlayEffect(Collections.singletonList(overlay));

                videoItems.add(new EditedMediaItem.Builder(textItem)
                    .setFrameRate(24)
                    .setEffects(new Effects(Collections.emptyList(), Collections.singletonList(effect)))
                    .build());

                cursorMs = startMs + lineDur;
            }

            // Completăm cu fundal până la finalul melodiei
            if (totalDurationMs > cursorMs) {
                MediaItem endItem = new MediaItem.Builder()
                    .setUri(Uri.fromFile(new File(bgPath)))
                    .setImageDurationMs(totalDurationMs - cursorMs)
                    .build();
                videoItems.add(new EditedMediaItem.Builder(endItem).setFrameRate(24).build());
            }

            EditedMediaItem editedAudio = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(new File(audioPath))))
                .setRemoveVideo(true)
                .build();

            List<EditedMediaItemSequence> sequences = new ArrayList<>();
            sequences.add(new EditedMediaItemSequence(videoItems));
            sequences.add(new EditedMediaItemSequence(Collections.singletonList(editedAudio)));

            Composition composition = new Composition.Builder(sequences).build();
            runTransformer(composition, outFile, call);
        } catch (Exception e) {
            call.reject("Eroare karaoke: " + e.getMessage());
        }
    }

}
