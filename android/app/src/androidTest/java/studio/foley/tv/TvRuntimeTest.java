package studio.foley.tv;

import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;
import java.io.File;
import java.io.FileOutputStream;
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
    private void capture(String name) throws Exception {
        Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("No emulator screenshot",bitmap);
        File file=new File(activity.getActivity().getExternalFilesDir(null),name+".png");
        try(FileOutputStream out=new FileOutputStream(file)){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}
        bitmap.recycle();
    }
    @Test public void tvLaunchRemotePairAndResume() throws Exception {
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
        }catch(Throwable error){capture("failure");throw error;}
    }
}
