package com.qurannaba.app;

import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Android's calls for the adhan (Adhan): a prayer time has come, the Stop button was tapped, or the
 * alarm has to be set again (Android forgets alarms when the phone restarts, and one set before
 * "Alarms & reminders" was allowed is only approximate).
 */
public class AdhanReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Adhan.ACTION_SOUND.equals(action)) {
            Adhan.sound(context, intent.getLongExtra(Adhan.EXTRA_AT, 0));
        } else if (Adhan.ACTION_STOP.equals(action)) {
            Adhan.stop(context);
        } else if (
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action)
        ) {
            Adhan.scheduleNext(context);
        }
    }
}
