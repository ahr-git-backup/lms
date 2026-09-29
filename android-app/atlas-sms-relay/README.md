# ATLAS SMS Relay (Android app)

Nijer banano payment-verification app — PipraPay-r moto SMS forward kore,
kintu third-party service na, LMS-er nijer backend-e sরাসরি pathay.

## Ki kore
1. Phone-e bKash/Nagad theke "you have received" SMS ashle dhore
2. TrxID + Amount + sender-number parse kore (SmsParser.java)
3. Backend-e POST kore (WorkManager diye — retry/backoff shoho, offline
   hole queue-e thake, internet ashle nijei pathay)
4. Phone restart hole nijei abar chalu hoy (BootReceiver)
5. Foreground service diye background-e "always on" thake

## Build korar niyom (Android Studio lagbe)
1. Android Studio-te `android-app/atlas-sms-relay` folder open koro
   (Gradle sync nijei hobe — SDK download korbe)
2. `app/build.gradle`-e kono change lagbe na, defaults thik ache
3. Run/Build > Build APK, ba `./gradlew assembleRelease`
4. APK phone-e install koro (Unknown Sources allow korte hobe)

## App khular por
1. "Backend URL" field-e QuizBot-er endpoint URL diba (backend banano
   hoyle dibo)
2. "Shared Secret" field-e ekta secret code diba (backend-e-o eki secret
   set korte hobe — eta na mile SMS accept hobe na, spam protection)
3. "সার্ভিস চালু করো" chapo, SMS permission dio
4. "ব্যাটারি অপ্টিমাইজেশন বন্ধ করো" চাপো — na hole Android kichukhon por
   app-take background-e kill kore dite pare

## Requirements
- Phone-ta shobshomoy on + internet + SIM active thakte hobe
- Battery optimization off na korle app majhe majhe বন্ধ hoye jete pare
