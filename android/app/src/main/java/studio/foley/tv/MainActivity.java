package studio.foley.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.net.Uri;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** TV director surface. Paired phones own the microphone; no native JS capability bridge. */
public class MainActivity extends Activity {
    private WebView web;
    private LinearLayout frame;
    private LinearLayout offline;
    private String lastTrustedUrl;
    private String tvUrl() { return BuildConfig.FOLEY_URL.replaceAll("/$", "") + "/tv"; }
    private boolean trusted(Uri target) {
        Uri allowed=Uri.parse(BuildConfig.FOLEY_URL);
        int targetPort=target.getPort()==-1?443:target.getPort();
        int allowedPort=allowed.getPort()==-1?443:allowed.getPort();
        return "https".equals(target.getScheme()) && allowed.getHost().equals(target.getHost())
            && targetPort==allowedPort && target.getUserInfo()==null;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        frame=new LinearLayout(this); frame.setOrientation(LinearLayout.VERTICAL);
        frame.setBackgroundColor(Color.rgb(243,236,223));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(243,236,223));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) { return !trusted(request.getUrl()); }
            @Override public void onPageFinished(WebView view,String url) {
                if(trusted(Uri.parse(url)))lastTrustedUrl=url;
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if(request.isForMainFrame())showOffline();
            }
        });
        frame.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(frame);
        if(state==null || web.restoreState(state)==null)web.loadUrl(tvUrl());
        web.requestFocus();
    }
    private void showOffline() {
        web.setVisibility(View.GONE);
        if(offline!=null)frame.removeView(offline);
        offline=new LinearLayout(this);offline.setOrientation(LinearLayout.VERTICAL);offline.setPadding(72,64,72,64);
        TextView title=new TextView(this);title.setText("The studio is out of reach.");title.setTextSize(32);title.setTextColor(Color.rgb(41,44,39));offline.addView(title);
        TextView help=new TextView(this);help.setText("Check this TV’s connection and the Foley server, then try again. Saved studios remain available until they expire.");help.setTextSize(20);help.setPadding(0,20,0,28);help.setTextColor(Color.rgb(65,70,61));offline.addView(help);
        Button retry=new Button(this);retry.setText("Try the studio again");retry.setOnClickListener(v->{frame.removeView(offline);offline=null;web.setVisibility(View.VISIBLE);web.loadUrl(lastTrustedUrl==null?tvUrl():lastTrustedUrl);web.requestFocus();});offline.addView(retry);
        frame.addView(offline,new LinearLayout.LayoutParams(-1,-1));retry.requestFocus();
    }
    private void leaveApp() { new AlertDialog.Builder(this).setTitle("Leave Foley?").setMessage("Your studio stays saved until it expires.").setPositiveButton("Leave",(dialog,which)->finish()).setNegativeButton("Keep creating",null).show(); }
    @Override public boolean onKeyDown(int code,KeyEvent event) {
        if(code==KeyEvent.KEYCODE_BACK) {
            if(event.getRepeatCount()>0)return true;
            if(offline!=null){leaveApp();return true;}
            web.evaluateJavascript("Boolean(window.FoleyTV && window.FoleyTV.back())",handled->{
                if("true".equals(handled))return;
                String path=Uri.parse(web.getUrl()==null?tvUrl():web.getUrl()).getPath();
                if("/tv".equals(path)||"/".equals(path)||!web.canGoBack())leaveApp();else web.goBack();
            });return true;
        }
        // D-pad/Select and media keys continue into WebView as real key input.
        // Do not consume system Home, microphone/search or volume controls.
        return super.onKeyDown(code,event);
    }
    @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
    @Override protected void onPause(){web.evaluateJavascript("window.FoleyTV && window.FoleyTV.suspend()",null);web.onPause();web.pauseTimers();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
    @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
