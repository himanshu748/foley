package studio.foley.tv;

import android.graphics.Bitmap;
import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.CookieManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;
import java.io.OutputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Runs inside the installed APK on an Android TV system image, not desktop Chromium. */
@RunWith(AndroidJUnit4.class)
public class TvRuntimeTest {
    @Rule public ActivityTestRule<MainActivity> activity = new ActivityTestRule<>(MainActivity.class);

    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup)view;
            for (int i=0; i<group.getChildCount(); i++) {
                WebView found=findWeb(group.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }
    private String read(String expression) throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> value=new AtomicReference<>();
        activity.getActivity().runOnUiThread(()->findWeb(activity.getActivity().getWindow().getDecorView())
            .evaluateJavascript(expression,result->{value.set(result);done.countDown();}));
        assertTrue("WebView did not answer",done.await(5,TimeUnit.SECONDS));
        return value.get();
    }
    private void until(String expression) throws Exception {
        long deadline=SystemClock.elapsedRealtime()+30000;
        String result="";
        do {
            result=read("Boolean("+expression+")");
            if("true".equals(result))return;
            SystemClock.sleep(200);
        }while(SystemClock.elapsedRealtime()<deadline);
        fail("Timed out: "+expression+"; result="+result+"; page="+read("document.body.innerText"));
    }
    private void key(int code) {
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(code);
    }
    private void settleCreditsVisualState() throws Exception {
        CountDownLatch ready=new CountDownLatch(1);
        activity.getActivity().runOnUiThread(()->findWeb(activity.getActivity().getWindow().getDecorView())
            .postVisualStateCallback(SystemClock.uptimeMillis(),new WebView.VisualStateCallback(){
                @Override public void onComplete(long requestId){ready.countDown();}
            }));
        assertTrue("Credits visual state did not become drawable",ready.await(5,TimeUnit.SECONDS));
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        // DOM readiness precedes the compositor's draw. Keep the Activity alive
        // for the real credits frame to reach screenshots and emulator recording.
        SystemClock.sleep(1500);
    }
    private void capture(String name) throws Exception {
        Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("No emulator screenshot",bitmap);
        // MediaStore output survives Gradle uninstalling the test application.
        ContentValues values=new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME,name+".png");
        values.put(MediaStore.Images.Media.MIME_TYPE,"image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/FoleyTest");
        Uri target=activity.getActivity().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
        assertNotNull(target);
        try(OutputStream out=activity.getActivity().getContentResolver().openOutputStream(target)){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}
        bitmap.recycle();
    }
    private String string(String expression) throws Exception {
        return new JSONArray("["+read(expression)+"]").getString(0);
    }
    private JSONObject request(String path,String method,String cookie,byte[] body,boolean audio) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(BuildConfig.FOLEY_URL+"/api"+path).openConnection();
        connection.setConnectTimeout(10000);connection.setReadTimeout(10000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Origin",BuildConfig.FOLEY_URL);
        if(cookie!=null)connection.setRequestProperty("Cookie",cookie);
        if(body!=null){
            connection.setRequestProperty("Content-Type",audio?"audio/wav":"application/json");
            if(audio)connection.setRequestProperty("x-take-name","Generated%20TV%20test%20tone");
            connection.setDoOutput(true);
            try(OutputStream out=connection.getOutputStream()){out.write(body);}
        }
        try {
            assertTrue("API status for "+path+": "+connection.getResponseCode(),connection.getResponseCode()<300);
            JSONObject result=new JSONObject(new String(connection.getInputStream().readAllBytes(),StandardCharsets.UTF_8));
            String setCookie=connection.getHeaderField("Set-Cookie");
            if(setCookie!=null)result.put("testCookie",setCookie.split(";",2)[0]);
            return result;
        }finally{connection.disconnect();}
    }
    private byte[] json(JSONObject value){return value.toString().getBytes(StandardCharsets.UTF_8);}
    private byte[] tone() {
        ByteBuffer wav=ByteBuffer.allocate(44+48000*2).order(ByteOrder.LITTLE_ENDIAN);
        wav.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(wav.capacity()-8);
        wav.put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1);
        wav.putInt(48000).putInt(96000).putShort((short)2).putShort((short)16);
        wav.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(48000*2);
        for(int i=0;i<48000;i++)wav.putShort((short)(Math.sin(i*2*Math.PI*260/48000)*5000));
        return wav.array();
    }
    @Test public void tvLaunchRemotePairResumeAndPremiere() throws Exception {
        try {
            assertTrue(activity.getActivity().getPackageManager().hasSystemFeature("android.software.leanback"));
            until("document.activeElement && document.activeElement.textContent.includes('Start a studio')");
            until("document.querySelector('[data-renderer=\"2d-selected\"]')");
            capture("01-tv-home");
            key(KeyEvent.KEYCODE_DPAD_CENTER);
            until("location.pathname.startsWith('/studio/') && location.search==='?tv=1'");
            until("document.activeElement.textContent.includes('Pair crew')");
            until("document.querySelector('.pair-code') && document.querySelector('.pair-code').textContent.trim().length===6");
            String studio=read("location.href");
            capture("02-tv-pair-code");
            key(KeyEvent.KEYCODE_DPAD_RIGHT);
            until("document.activeElement.textContent.includes('Cast sounds')");
            key(KeyEvent.KEYCODE_DPAD_LEFT);
            until("document.activeElement.textContent.includes('Pair crew')");
            key(KeyEvent.KEYCODE_BACK);
            until("location.pathname==='/tv' && document.body.innerText.includes('Resume your studio')");
            until("document.activeElement.textContent.includes('Start a studio')");
            key(KeyEvent.KEYCODE_DPAD_DOWN);
            until("document.activeElement.textContent.includes('Resume your studio')");
            key(KeyEvent.KEYCODE_DPAD_CENTER);
            until("location.href==="+studio);
            capture("03-tv-resumed");

            // An API fixture crew supplies an explicitly synthetic WAV. This is
            // playback integration evidence, not a physical phone/microphone claim.
            String id=string("location.pathname.split('/')[2]");
            String base="/sessions/"+id;
            String host=CookieManager.getInstance().getCookie(BuildConfig.FOLEY_URL+"/api"+base);
            JSONObject state=request(base,"GET",host,null,false);
            JSONObject crew=request("/join","POST",null,json(new JSONObject().put("code",state.getString("code")).put("name","Synthetic test crew")),false);
            JSONObject clip=request(base+"/clips","POST",crew.getString("testCookie"),tone(),true);
            for(String role:new String[]{"footsteps","weather","creature"}){
                state=request(base,"GET",host,null,false);
                request(base+"/cast","POST",host,json(new JSONObject().put("role",role).put("clipId",clip.getString("id")).put("revision",state.getInt("revision")).put("volume",0.8)),false);
            }
            until("document.body.innerText.includes('Your soundtrack is ready.')");
            until("document.activeElement.textContent.includes('Pair crew')");
            key(KeyEvent.KEYCODE_DPAD_RIGHT);
            until("document.activeElement.textContent.includes('Cast sounds')");
            key(KeyEvent.KEYCODE_DPAD_RIGHT);
            until("document.activeElement.textContent.includes('Premiere')");
            key(KeyEvent.KEYCODE_DPAD_CENTER);
            until("document.activeElement.textContent.includes('Premiere your film')");
            key(KeyEvent.KEYCODE_DPAD_CENTER);
            until("document.querySelector('.screen.is-playing')");
            until("parseInt(document.querySelector('.screen-top > span:last-child').textContent,10)>=3");
            until("document.querySelector('.picture').getBoundingClientRect().top>=0 && document.querySelector('.picture').getBoundingClientRect().bottom<=innerHeight");
            capture("04-tv-playing-synthetic-audio");
            until("document.querySelector('.film-credits') && !document.querySelector('.screen.is-playing')");
            until("document.querySelector('.film-credits').innerText.includes('Synthetic test crew')");
            until("document.querySelector('.picture').getBoundingClientRect().top>=0 && document.querySelector('.picture').getBoundingClientRect().bottom<=innerHeight");
            settleCreditsVisualState();
            capture("05-tv-credits");
            SystemClock.sleep(1500);
            state=request(base,"GET",host,null,false);
            assertEquals("Server premiere receipt",1,state.getInt("premieres"));
        }catch(Throwable error){capture("failure");throw error;}
    }
}
