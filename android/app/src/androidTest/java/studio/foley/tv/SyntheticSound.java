package studio.foley.tv;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Random;

/** Original deterministic sound-design fixtures, never microphone recordings. */
final class SyntheticSound {
    static byte[] wav(String role) {
        if (!role.equals("footsteps") && !role.equals("weather") && !role.equals("creature"))
            throw new IllegalArgumentException("Unknown synthetic role");
        int rate = 48000, frames = rate;
        ByteBuffer wav = ByteBuffer.allocate(44 + frames * 2).order(ByteOrder.LITTLE_ENDIAN);
        wav.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(wav.capacity() - 8);
        wav.put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1);
        wav.putInt(rate).putInt(rate * 2).putShort((short)2).putShort((short)16);
        wav.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(frames * 2);
        Random random = new Random(20261003);
        double filtered = 0;
        for (int i = 0; i < frames; i++) {
            double t = (double)i / rate, noise = random.nextDouble() * 2 - 1;
            filtered = filtered * .92 + noise * .08;
            double value;
            if (role.equals("footsteps"))
                value = Math.exp(-t * 22) * (.65 * Math.sin(2 * Math.PI * 110 * t) + .35 * noise);
            else if (role.equals("weather"))
                value = filtered * 3 * (.65 + .35 * Math.sin(Math.PI * t));
            else
                value = Math.sin(2 * Math.PI * (280 * t + 220 * t * t)) * Math.sin(Math.PI * t);
            // Short edge fades keep the repeated weather clip from clicking.
            double fade = Math.min(1, Math.min(t / .005, (1 - t) / .02));
            wav.putShort((short)(Math.max(-1, Math.min(1, value * fade)) * 9000));
        }
        return wav.array();
    }
}
