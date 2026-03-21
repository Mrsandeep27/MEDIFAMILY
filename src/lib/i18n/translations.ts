export type Locale = "en" | "hi";

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Nav
    "nav.home": "Home",
    "nav.family": "Family",
    "nav.scan": "Scan",
    "nav.records": "Records",
    "nav.more": "More",

    // Home
    "home.greeting": "Hi",
    "home.quick_scan": "Scan Prescription",
    "home.quick_add": "Add Record",
    "home.quick_emergency": "Emergency Card",
    "home.family_members": "Family Members",
    "home.view_all": "View All",
    "home.recent_records": "Recent Records",
    "home.no_records": "No records yet. Add your first health record to get started.",

    // Family
    "family.title": "Family",
    "family.add": "Add",
    "family.no_members": "No family members",
    "family.no_members_desc": "Add your family members to manage their health records",
    "family.add_member": "Add Family Member",
    "family.edit_member": "Edit Member",
    "family.name": "Name",
    "family.relation": "Relation",
    "family.dob": "Date of Birth",
    "family.blood_group": "Blood Group",
    "family.gender": "Gender",
    "family.allergies": "Allergies",
    "family.conditions": "Chronic Conditions",
    "family.emergency_contact": "Emergency Contact",

    // Records
    "records.title": "Health Records",
    "records.add": "Add Record",
    "records.no_records": "No records yet",
    "records.search": "Search records, doctors, diagnosis...",
    "records.type": "Record Type",
    "records.visit_date": "Visit Date",
    "records.doctor": "Doctor Name",
    "records.hospital": "Hospital",
    "records.diagnosis": "Diagnosis",
    "records.notes": "Notes",
    "records.tags": "Tags",
    "records.photos": "Photos / Documents",
    "records.save": "Save Record",

    // Scanner
    "scan.title": "Scan Prescription",
    "scan.take_photo": "Take Photo",
    "scan.take_photo_desc": "Point your camera at the prescription",
    "scan.upload": "Upload from Gallery",
    "scan.upload_desc": "Select an existing photo",
    "scan.processing": "Processing",
    "scan.extracting": "Extracting text from image...",
    "scan.analyzing": "Analyzing prescription with AI...",
    "scan.review": "Review Extraction",
    "scan.rescan": "Rescan",
    "scan.save_for": "Save for",
    "scan.save": "Save Prescription",

    // Reminders
    "reminders.title": "Reminders",
    "reminders.today": "Today",
    "reminders.all": "All",
    "reminders.add": "New Reminder",
    "reminders.no_today": "No reminders for today",
    "reminders.no_all": "No reminders",
    "reminders.medicine_name": "Medicine Name",
    "reminders.time": "Time",
    "reminders.dosage": "Dosage",
    "reminders.days": "Days",
    "reminders.before_food": "Before food",
    "reminders.after_food": "After food",

    // Settings
    "settings.title": "Settings",
    "settings.pin_lock": "PIN Lock",
    "settings.notifications": "Notifications",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.sync": "Sync",
    "settings.export": "Export Data",
    "settings.sign_out": "Sign Out",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.success": "Success",
    "common.all": "All",
  },

  hi: {
    // Nav
    "nav.home": "\u0939\u094B\u092E",
    "nav.family": "\u092A\u0930\u093F\u0935\u093E\u0930",
    "nav.scan": "\u0938\u094D\u0915\u0948\u0928",
    "nav.records": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921",
    "nav.more": "\u0905\u0927\u093F\u0915",

    // Home
    "home.greeting": "\u0928\u092E\u0938\u094D\u0924\u0947",
    "home.quick_scan": "\u092A\u094D\u0930\u093F\u0938\u094D\u0915\u094D\u0930\u093F\u092A\u094D\u0936\u0928 \u0938\u094D\u0915\u0948\u0928 \u0915\u0930\u0947\u0902",
    "home.quick_add": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u091C\u094B\u0921\u093C\u0947\u0902",
    "home.quick_emergency": "\u0907\u092E\u0930\u094D\u091C\u0947\u0902\u0938\u0940 \u0915\u093E\u0930\u094D\u0921",
    "home.family_members": "\u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u0947 \u0938\u0926\u0938\u094D\u092F",
    "home.view_all": "\u0938\u092C \u0926\u0947\u0916\u0947\u0902",
    "home.recent_records": "\u0939\u093E\u0932 \u0915\u0947 \u0930\u093F\u0915\u0949\u0930\u094D\u0921",
    "home.no_records": "\u0905\u092D\u0940 \u0915\u094B\u0908 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0928\u0939\u0940\u0902\u0964 \u0936\u0941\u0930\u0942 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0905\u092A\u0928\u093E \u092A\u0939\u0932\u093E \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u091C\u094B\u0921\u093C\u0947\u0902\u0964",

    // Family
    "family.title": "\u092A\u0930\u093F\u0935\u093E\u0930",
    "family.add": "\u091C\u094B\u0921\u093C\u0947\u0902",
    "family.no_members": "\u0915\u094B\u0908 \u0938\u0926\u0938\u094D\u092F \u0928\u0939\u0940\u0902",
    "family.no_members_desc": "\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u0947 \u0938\u0926\u0938\u094D\u092F\u094B\u0902 \u0915\u094B \u091C\u094B\u0921\u093C\u0947\u0902",
    "family.add_member": "\u0938\u0926\u0938\u094D\u092F \u091C\u094B\u0921\u093C\u0947\u0902",
    "family.edit_member": "\u0938\u0926\u0938\u094D\u092F \u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902",
    "family.name": "\u0928\u093E\u092E",
    "family.relation": "\u0930\u093F\u0936\u094D\u0924\u093E",
    "family.dob": "\u091C\u0928\u094D\u092E \u0924\u093F\u0925\u093F",
    "family.blood_group": "\u0930\u0915\u094D\u0924 \u0938\u092E\u0942\u0939",
    "family.gender": "\u0932\u093F\u0902\u0917",
    "family.allergies": "\u090F\u0932\u0930\u094D\u091C\u0940",
    "family.conditions": "\u092A\u0941\u0930\u093E\u0928\u0940 \u092C\u0940\u092E\u093E\u0930\u093F\u092F\u093E\u0901",
    "family.emergency_contact": "\u0906\u092A\u093E\u0924\u0915\u093E\u0932\u0940\u0928 \u0938\u0902\u092A\u0930\u094D\u0915",

    // Records
    "records.title": "\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0930\u093F\u0915\u0949\u0930\u094D\u0921",
    "records.add": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u091C\u094B\u0921\u093C\u0947\u0902",
    "records.no_records": "\u0905\u092D\u0940 \u0915\u094B\u0908 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0928\u0939\u0940\u0902",
    "records.search": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921, \u0921\u0949\u0915\u094D\u091F\u0930, \u0928\u093F\u0926\u093E\u0928 \u0916\u094B\u091C\u0947\u0902...",
    "records.type": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u092A\u094D\u0930\u0915\u093E\u0930",
    "records.visit_date": "\u0935\u093F\u091C\u093F\u091F \u0924\u093E\u0930\u0940\u0916",
    "records.doctor": "\u0921\u0949\u0915\u094D\u091F\u0930 \u0915\u093E \u0928\u093E\u092E",
    "records.hospital": "\u0905\u0938\u094D\u092A\u0924\u093E\u0932",
    "records.diagnosis": "\u0928\u093F\u0926\u093E\u0928",
    "records.notes": "\u0928\u094B\u091F\u094D\u0938",
    "records.tags": "\u091F\u0948\u0917",
    "records.photos": "\u092B\u093C\u094B\u091F\u094B / \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C",
    "records.save": "\u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0938\u0939\u0947\u091C\u0947\u0902",

    // Scanner
    "scan.title": "\u092A\u094D\u0930\u093F\u0938\u094D\u0915\u094D\u0930\u093F\u092A\u094D\u0936\u0928 \u0938\u094D\u0915\u0948\u0928 \u0915\u0930\u0947\u0902",
    "scan.take_photo": "\u092B\u093C\u094B\u091F\u094B \u0932\u0947\u0902",
    "scan.take_photo_desc": "\u092A\u094D\u0930\u093F\u0938\u094D\u0915\u094D\u0930\u093F\u092A\u094D\u0936\u0928 \u092A\u0930 \u0915\u0948\u092E\u0930\u093E \u092A\u0949\u0907\u0902\u091F \u0915\u0930\u0947\u0902",
    "scan.upload": "\u0917\u0948\u0932\u0930\u0940 \u0938\u0947 \u0905\u092A\u0932\u094B\u0921 \u0915\u0930\u0947\u0902",
    "scan.upload_desc": "\u092E\u094C\u091C\u0942\u0926\u093E \u092B\u093C\u094B\u091F\u094B \u091A\u0941\u0928\u0947\u0902",
    "scan.processing": "\u092A\u094D\u0930\u094B\u0938\u0947\u0938\u093F\u0902\u0917",
    "scan.extracting": "\u091A\u093F\u0924\u094D\u0930 \u0938\u0947 \u091F\u0947\u0915\u094D\u0938\u094D\u091F \u0928\u093F\u0915\u093E\u0932 \u0930\u0939\u0947 \u0939\u0948\u0902...",
    "scan.analyzing": "AI \u0938\u0947 \u092A\u094D\u0930\u093F\u0938\u094D\u0915\u094D\u0930\u093F\u092A\u094D\u0936\u0928 \u0915\u093E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923...",
    "scan.review": "\u0928\u093F\u0937\u094D\u0915\u0930\u094D\u0937\u0923 \u0915\u0940 \u0938\u092E\u0940\u0915\u094D\u0937\u093E",
    "scan.rescan": "\u092B\u093F\u0930 \u0938\u0947 \u0938\u094D\u0915\u0948\u0928",
    "scan.save_for": "\u0915\u093F\u0938\u0915\u0947 \u0932\u093F\u090F \u0938\u0939\u0947\u091C\u0947\u0902",
    "scan.save": "\u092A\u094D\u0930\u093F\u0938\u094D\u0915\u094D\u0930\u093F\u092A\u094D\u0936\u0928 \u0938\u0939\u0947\u091C\u0947\u0902",

    // Reminders
    "reminders.title": "\u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930",
    "reminders.today": "\u0906\u091C",
    "reminders.all": "\u0938\u092D\u0940",
    "reminders.add": "\u0928\u092F\u093E \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930",
    "reminders.no_today": "\u0906\u091C \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930 \u0928\u0939\u0940\u0902",
    "reminders.no_all": "\u0915\u094B\u0908 \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930 \u0928\u0939\u0940\u0902",
    "reminders.medicine_name": "\u0926\u0935\u093E\u0908 \u0915\u093E \u0928\u093E\u092E",
    "reminders.time": "\u0938\u092E\u092F",
    "reminders.dosage": "\u0916\u0941\u0930\u093E\u0915",
    "reminders.days": "\u0926\u093F\u0928",
    "reminders.before_food": "\u0916\u093E\u0928\u0947 \u0938\u0947 \u092A\u0939\u0932\u0947",
    "reminders.after_food": "\u0916\u093E\u0928\u0947 \u0915\u0947 \u092C\u093E\u0926",

    // Settings
    "settings.title": "\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938",
    "settings.pin_lock": "PIN \u0932\u0949\u0915",
    "settings.notifications": "\u0938\u0942\u091A\u0928\u093E\u090F\u0902",
    "settings.language": "\u092D\u093E\u0937\u093E",
    "settings.theme": "\u0925\u0940\u092E",
    "settings.sync": "\u0938\u093F\u0902\u0915",
    "settings.export": "\u0921\u0947\u091F\u093E \u090F\u0915\u094D\u0938\u092A\u094B\u0930\u094D\u091F",
    "settings.sign_out": "\u0938\u093E\u0907\u0928 \u0906\u0909\u091F",

    // Common
    "common.save": "\u0938\u0939\u0947\u091C\u0947\u0902",
    "common.cancel": "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    "common.delete": "\u0939\u091F\u093E\u090F\u0902",
    "common.edit": "\u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902",
    "common.loading": "\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...",
    "common.error": "\u0915\u0941\u091B \u0917\u0932\u0924 \u0939\u094B \u0917\u092F\u093E",
    "common.success": "\u0938\u092B\u0932",
    "common.all": "\u0938\u092D\u0940",
  },
};

export function t(key: string, locale: Locale = "en"): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}
