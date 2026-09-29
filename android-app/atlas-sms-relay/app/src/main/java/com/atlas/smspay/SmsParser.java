package com.atlas.smspay;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses a bKash/Nagad "you have received" SMS body into (trxId, amount).
 * Real sample formats these were built against:
 *   "You have received Tk 1,250.00 from 018XXXXXXXX. Fee Tk 0.00.
 *    Balance Tk XXXX. TrxID 8MH2F1XHMY at 15/07/2026 11:00"
 *   "Cash In Tk 3,260.00 from 0199999999 successful. Fee Tk 0.00.
 *    Balance Tk 0.00. TrxID XYZABC at 14/07/2026 20:19"
 * Nagad SMS use the same "TrxID <alphanumeric>" and "Tk <amount>" shape.
 * Only messages containing "TrxID" are treated as payment SMS at all —
 * everything else (promos, OTPs) is ignored before parsing is attempted.
 */
public class SmsParser {

    // TrxID: bKash/Nagad both use a short alphanumeric code, no spaces.
    private static final Pattern TRX_ID = Pattern.compile("TrxID\\s*[:\\-]?\\s*([A-Za-z0-9]{6,})", Pattern.CASE_INSENSITIVE);

    // First "Tk <amount>" occurrence is always the transaction amount
    // (fee/balance mentions come after it in every known sample).
    private static final Pattern AMOUNT = Pattern.compile("Tk\\.?\\s*([0-9][0-9,]*\\.?[0-9]*)", Pattern.CASE_INSENSITIVE);

    // Sender's phone number, when present ("from 018XXXXXXXX").
    private static final Pattern SENDER = Pattern.compile("from\\s+(01[0-9]{9})", Pattern.CASE_INSENSITIVE);

    public static class ParsedPayment {
        public final String trxId;
        public final String amount; // as a plain decimal string, commas stripped
        public final String senderPhone; // may be null

        ParsedPayment(String trxId, String amount, String senderPhone) {
            this.trxId = trxId;
            this.amount = amount;
            this.senderPhone = senderPhone;
        }
    }

    /** Returns null if this doesn't look like a payment-received SMS at all. */
    public static ParsedPayment parse(String body) {
        if (body == null) return null;

        Matcher trxMatcher = TRX_ID.matcher(body);
        if (!trxMatcher.find()) return null; // not a payment SMS we recognize

        Matcher amountMatcher = AMOUNT.matcher(body);
        if (!amountMatcher.find()) return null;

        String trxId = trxMatcher.group(1);
        String amount = amountMatcher.group(1).replace(",", "");

        String sender = null;
        Matcher senderMatcher = SENDER.matcher(body);
        if (senderMatcher.find()) {
            sender = senderMatcher.group(1);
        }

        return new ParsedPayment(trxId, amount, sender);
    }
}
