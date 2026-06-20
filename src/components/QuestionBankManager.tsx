import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  setDoc,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "../utils/firebase.ts";
import { BankQuestion } from "../types.ts";
import AssetManagerModal from "./AssetManagerModal.tsx";
import {
  Plus,
  Upload,
  Search,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  Filter,
  Loader2,
  Wand2,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface QuestionBankManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function QuestionBankManager({
  onNotify,
}: QuestionBankManagerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-seed CRE-4 questions
  useEffect(() => {
    if (localStorage.getItem("cre4_injected_p2") === "true") return;
    
    // Check if we are ready and questions are loaded
    if (questions.length > 0) {
      const inject = async () => {
        try {
          const cre4 = [{"englishQuestion":"What is the normal fasting blood sugar level?","hindiQuestion":"सामान्य उपवास रक्त शर्करा (Fasting Blood Sugar) कितनी होती है?","englishOptions":["40–80 mg/dL","60–90 mg/dL","70–110 mg/dL","120–140 mg/dL"],"hindiOptions":["40–80 mg/dL","60–90 mg/dL","70–110 mg/dL","120–140 mg/dL"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"DCT detects:","hindiQuestion":"DCT (Direct Coombs Test) क्या पता लगाता है?","englishOptions":["Plasma antibodies","Complement only","Antibodies attached to RBCs in vivo","Antigens"],"hindiOptions":["प्लाज़्मा एंटीबॉडी","केवल कॉम्प्लीमेंट","RBCs पर जुड़े एंटीबॉडी","एंटीजन"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Most abundant plasma protein is:","hindiQuestion":"प्लाज़्मा में सबसे अधिक मात्रा में पाया जाने वाला प्रोटीन कौन-सा है?","englishOptions":["Globulin","Fibrinogen","Transferrin","Albumin"],"hindiOptions":["ग्लोब्युलिन","फाइब्रिनोजन","ट्रांसफेरिन","एल्ब्यूमिन"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"IgE is associated with:","hindiQuestion":"IgE किससे संबंधित है?","englishOptions":["Bacterial infection","Autoimmunity","Allergic reaction","Blood grouping"],"hindiOptions":["बैक्टीरियल संक्रमण","ऑटोइम्यून रोग","एलर्जिक प्रतिक्रिया","रक्त समूह"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Universal donor is:","hindiQuestion":"सार्वभौमिक रक्तदाता (Universal Donor) कौन है?","englishOptions":["AB+","A−","B−","O−"],"hindiOptions":["AB+","A−","B−","O−"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Cryostat is used for:","hindiQuestion":"Cryostat का उपयोग किस लिए किया जाता है?","englishOptions":["Fixation","Staining","Frozen section","Embedding"],"hindiOptions":["फिक्सेशन","स्टेनिंग","Frozen Section","एम्बेडिंग"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"PPE stands for:","hindiQuestion":"PPE का पूर्ण रूप क्या है?","englishOptions":["Personal Patient Equipment","Personal Processing Equipment","Personal Protective Equipment","Protective Patient Equipment"],"hindiOptions":["Personal Patient Equipment","Personal Processing Equipment","Personal Protective Equipment","Protective Patient Equipment"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Gram-positive bacteria retain crystal violet due to:","hindiQuestion":"Gram-positive बैक्टीरिया Crystal Violet रंग क्यों बनाए रखते हैं?","englishOptions":["Capsule","Lipid layer","Teichoic acid only","Thick peptidoglycan layer"],"hindiOptions":["कैप्सूल","लिपिड परत","केवल Teichoic Acid","मोटी Peptidoglycan परत"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Increased bleeding time indicates:","hindiQuestion":"Bleeding Time बढ़ना किसका संकेत है?","englishOptions":["RBC disorder","Platelet disorder","Hemolysis","Polycythemia"],"hindiOptions":["RBC विकार","Platelet विकार","Hemolysis","Polycythemia"],"correctOptionIndex":1,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Microcytic hypochromic anemia is commonly due to:","hindiQuestion":"Microcytic Hypochromic Anemia का मुख्य कारण क्या है?","englishOptions":["B12 deficiency","Folate deficiency","Iron deficiency anemia","Hemophilia"],"hindiOptions":["Vitamin B12 की कमी","Folate की कमी","Iron Deficiency Anemia","Hemophilia"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Rh incompatibility mainly affects:","hindiQuestion":"Rh असंगति मुख्य रूप से किसे प्रभावित करती है?","englishOptions":["First pregnancy","Current pregnancy only","Subsequent pregnancies","Never affects fetus"],"hindiOptions":["पहली गर्भावस्था","केवल वर्तमान गर्भावस्था","अगली गर्भावस्थाएँ","कभी नहीं"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"What should be done after a needle-stick injury?","hindiQuestion":"Needle-stick injury होने पर क्या करना चाहिए?","englishOptions":["Ignore it","Cover wound","Report tomorrow","Immediate action/reporting"],"hindiOptions":["अनदेखा करें","घाव ढक दें","कल रिपोर्ट करें","तुरंत रिपोर्ट करें और कार्रवाई करें"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Hb estimation using HCl is done by:","hindiQuestion":"HCl का उपयोग किस Hb Estimation Method में होता है?","englishOptions":["Cyanmethemoglobin method","Drabkin method","Sahli method","HemoCue"],"hindiOptions":["Cyanmethemoglobin Method","Drabkin Method","Sahli Method","HemoCue"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Lifespan of RBC is:","hindiQuestion":"RBC का जीवनकाल कितना होता है?","englishOptions":["90 days","100 days","120 days","180 days"],"hindiOptions":["90 दिन","100 दिन","120 दिन","180 दिन"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Pancytopenia means decrease in:","hindiQuestion":"Pancytopenia का अर्थ है कमी होना—","englishOptions":["RBC only","WBC only","Platelets only","RBC + WBC + Platelets"],"hindiOptions":["केवल RBC","केवल WBC","केवल Platelets","RBC + WBC + Platelets"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Serum amylase rises in:","hindiQuestion":"Serum Amylase किस रोग में बढ़ता है?","englishOptions":["Hepatitis","Diabetes","Acute pancreatitis","Anemia"],"hindiOptions":["Hepatitis","Diabetes","Acute Pancreatitis","Anemia"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Reticulocyte count indicates:","hindiQuestion":"Reticulocyte Count किसका संकेत देता है?","englishOptions":["Kidney function","Liver function","Bone marrow activity","Spleen function"],"hindiOptions":["Kidney Function","Liver Function","Bone Marrow Activity","Spleen Function"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Acid alcohol in ZN stain acts as:","hindiQuestion":"Ziehl-Neelsen Stain में Acid Alcohol क्या कार्य करता है?","englishOptions":["Counterstain","Mordant","Primary stain","Decolorizer"],"hindiOptions":["Counterstain","Mordant","Primary Stain","Decolorizer"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"HbA1c reflects glucose control over:","hindiQuestion":"HbA1c पिछले कितने समय की ग्लूकोज़ नियंत्रण स्थिति बताता है?","englishOptions":["1 month","2 months","3–4 months","1 year"],"hindiOptions":["1 महीना","2 महीने","3–4 महीने","1 वर्ष"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Routine tissue fixative is:","hindiQuestion":"Routine Tissue Fixative कौन-सा है?","englishOptions":["Alcohol","Acetone","Xylene","Formalin"],"hindiOptions":["Alcohol","Acetone","Xylene","Formalin"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Malaria is commonly detected by:","hindiQuestion":"मलेरिया की पहचान सामान्यतः किससे की जाती है?","englishOptions":["ELISA","PCR","Peripheral blood film","Culture"],"hindiOptions":["ELISA","PCR","Peripheral Blood Film","Culture"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"}];
          const cre4_p2 = [{"englishQuestion":"Microtome is used for:","hindiQuestion":"Microtome का उपयोग किस लिए किया जाता है?","englishOptions":["Staining","Fixing","Cutting thin sections","Embedding"],"hindiOptions":["Staining","Fixing","पतले ऊतक खंड (Thin Sections) काटने के लिए","Embedding"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"Microtome का उपयोग Histopathology में ऊतकों की बहुत पतली स्लाइड बनाने के लिए किया जाता है।","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Major ketone body in DKA:","hindiQuestion":"DKA में प्रमुख Ketone Body कौन-सी होती है?","englishOptions":["Acetone","Acetoacetate","β-Hydroxybutyrate","Ethanol"],"hindiOptions":["Acetone","Acetoacetate","β-Hydroxybutyrate","Ethanol"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Flame photometry principle:","hindiQuestion":"Flame Photometry किस सिद्धांत पर आधारित है?","englishOptions":["Absorption","Reflection","Fluorescence","Emission"],"hindiOptions":["Absorption","Reflection","Fluorescence","Emission"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Culture & sensitivity identifies:","hindiQuestion":"Culture & Sensitivity Test क्या पहचानता है?","englishOptions":["Blood group","Glucose level","Organism and suitable antibiotic","Hemoglobin"],"hindiOptions":["Blood Group","Glucose Level","रोगजनक जीव एवं उपयुक्त एंटीबायोटिक","Hemoglobin"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Complement system belongs to:","hindiQuestion":"Complement System किस प्रकार की प्रतिरक्षा का भाग है?","englishOptions":["Adaptive immunity","Humoral immunity","Cell-mediated immunity","Innate immunity"],"hindiOptions":["Adaptive Immunity","Humoral Immunity","Cell-mediated Immunity","Innate Immunity"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"HBsAg indicates:","hindiQuestion":"HBsAg की उपस्थिति क्या दर्शाती है?","englishOptions":["Vaccination","Past infection","Recovery","Active Hepatitis B infection"],"hindiOptions":["Vaccination","पूर्व संक्रमण","रोगमुक्ति","सक्रिय Hepatitis B संक्रमण"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"BSL-2 requires:","hindiQuestion":"BSL-2 प्रयोगशाला में क्या आवश्यक है?","englishOptions":["Sample precautions","Environmental control","Personnel protection","All of the above"],"hindiOptions":["Sample Precautions","Environmental Control","Personnel Protection","उपरोक्त सभी"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Low albumin is seen in:","hindiQuestion":"Albumin का स्तर किस रोग में कम हो जाता है?","englishOptions":["Hypertension","Diabetes","Nephrotic syndrome","Polycythemia"],"hindiOptions":["Hypertension","Diabetes","Nephrotic Syndrome","Polycythemia"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Autoclave biological indicator:","hindiQuestion":"Autoclave का Biological Indicator कौन-सा है?","englishOptions":["E. coli","Bacillus subtilis","Clostridium","Geobacillus stearothermophilus"],"hindiOptions":["E. coli","Bacillus subtilis","Clostridium","Geobacillus stearothermophilus"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Normal gut flora:","hindiQuestion":"सामान्य आंतों के जीवाणुओं का मुख्य कार्य क्या है?","englishOptions":["Cause disease","Produce toxins","Prevent pathogen colonization","Destroy RBCs"],"hindiOptions":["रोग उत्पन्न करना","विष बनाना","रोगजनकों को बसने से रोकना","RBCs को नष्ट करना"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Sickle cell anemia involves defect in:","hindiQuestion":"Sickle Cell Anemia में दोष कहाँ होता है?","englishOptions":["RBC membrane","Platelets","WBCs","Hemoglobin structure"],"hindiOptions":["RBC Membrane","Platelets","WBCs","Hemoglobin Structure"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Abnormal hemoglobin in sickle cell disease:","hindiQuestion":"Sickle Cell Disease में असामान्य Hemoglobin कौन-सा है?","englishOptions":["HbA","HbF","HbA₂","HbS"],"hindiOptions":["HbA","HbF","HbA₂","HbS"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Calibration means:","hindiQuestion":"Calibration का अर्थ क्या है?","englishOptions":["Cleaning","Repairing","Validating instrument accuracy","Sterilizing"],"hindiOptions":["Cleaning","Repairing","यंत्र की सटीकता की जाँच","Sterilizing"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Hospital waste disposal follows:","hindiQuestion":"अस्पताल के जैव-चिकित्सा कचरे का निपटान किस नियम के अनुसार किया जाता है?","englishOptions":["WHO rules","NABL rules","CLIA rules","BMW Rules"],"hindiOptions":["WHO Rules","NABL Rules","CLIA Rules","BMW Rules"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"ELISA detects:","hindiQuestion":"ELISA किसका पता लगाता है?","englishOptions":["Glucose","Electrolytes","Antigens/Antibodies","Hemoglobin"],"hindiOptions":["Glucose","Electrolytes","Antigen/Antibody","Hemoglobin"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Coagulation tube contains:","hindiQuestion":"Coagulation Test Tube में कौन-सा Anticoagulant होता है?","englishOptions":["EDTA","Heparin","Fluoride","Sodium citrate"],"hindiOptions":["EDTA","Heparin","Fluoride","Sodium Citrate"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Preferred sample for blood glucose:","hindiQuestion":"Blood Glucose जांच के लिए सबसे उपयुक्त Sample कौन-सा है?","englishOptions":["Serum","Whole blood","EDTA plasma","Fluoride plasma"],"hindiOptions":["Serum","Whole Blood","EDTA Plasma","Fluoride Plasma"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Zero-order kinetics enzyme:","hindiQuestion":"Zero-order kinetics पर आधारित एंजाइम कौन-सा है?","englishOptions":["AST","ALT","LDH","ALP"],"hindiOptions":["AST","ALT","LDH","ALP"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Common liver function assessment:","hindiQuestion":"Liver Function की सामान्य जांच क्या कहलाती है?","englishOptions":["CBC","ESR","PT only","LFT"],"hindiOptions":["CBC","ESR","PT Only","LFT"],"correctOptionIndex":3,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"},{"englishQuestion":"Kidney function marker:","hindiQuestion":"Kidney Function का प्रमुख Marker कौन-सा है?","englishOptions":["Bilirubin","Albumin","Creatinine","Hemoglobin"],"hindiOptions":["Bilirubin","Albumin","Creatinine","Hemoglobin"],"correctOptionIndex":2,"englishExplanation":"","hindiExplanation":"","subject":"CRE-4","difficulty":"medium"}];
          const { writeBatch, doc } = await import('firebase/firestore');
          const batch = writeBatch(db);
          let added = 0;
          for (const q of cre4) {
            const docId = `QB_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
            batch.set(doc(db, 'questionBank', docId), {
              id: docId,
              ...q,
              createdAt: new Date().toISOString()
            });
            added++;
          }
          for (const q of cre4_p2) {
            const docId = `QB_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
            batch.set(doc(db, 'questionBank', docId), {
              id: docId,
              ...q,
              createdAt: new Date().toISOString()
            });
            added++;
          }
          await batch.commit();
          localStorage.setItem("cre4_injected_p2", "true");
          onNotify(`Successfully injected ${added} CRE-4 questions.`);
          fetchQuestions(true);
        } catch (e) {
          console.error("Failed to auto-inject CRE4", e);
        }
      };
      inject();
    }
  }, [questions, onNotify]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [showImageInputs, setShowImageInputs] = useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
  const [isRawTextModalOpen, setIsRawTextModalOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [languageMode, setLanguageMode] = useState<"bilingual" | "english">(
    "bilingual",
  );
  const [uploadSubject, setUploadSubject] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BankQuestion>>({
    englishQuestion: "",
    hindiQuestion: "",
    englishOptions: ["", "", "", ""],
    hindiOptions: ["", "", "", ""],
    englishExplanation: "",
    hindiExplanation: "",
    imageUrl: "",
    optionImageUrls: ["", "", "", ""],
    correctOptionIndex: 0,
    subject: "Miscellaneous",
    difficulty: "medium",
  });
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const fetchQuestions = async (skipAutoSeed = false) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "questionBank"));
      const list: BankQuestion[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.subject && data.subject.trim().toLowerCase() === 'mathematics') {
          data.subject = 'Math';
        }
        list.push({ id: d.id, ...data } as BankQuestion);
      });
      setQuestions(list);

      if (!skipAutoSeed && !list.some((q) => q.subject === "Reasoning")) {
        setTimeout(() => {
          handleSeedPDFQuestions();
        }, 500);
      }
    } catch (e) {
      console.error(e);
      onNotify("Failed to retrieve question bank.", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Read file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = (reader.result as string).split(",")[1];
          if (result) resolve(result);
          else reject(new Error("Could not parse file."));
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });

      onNotify("Extracting questions via Gemini AI. This may take a minute...");

      const response = await fetch("/api/admin/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentBase64: base64Data,
          mimeType: file.type || "text/plain",
          languageMode,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (!data.success || !data.questions) {
        throw new Error(data.error || "Failed to extract");
      }

      const extracted = data.questions;
      onNotify(
        `Extracted ${extracted.length} questions. Saving to database...`,
      );

      // Save all to firestore
      for (const q of extracted) {
        const qId =
          "qb_" + Date.now() + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, "questionBank", qId), {
          id: qId,
          englishQuestion: q.englishQuestion || "Missing English Context",
          hindiQuestion: q.hindiQuestion || "हिंदी अनुवाद उपलब्ध नहीं है",
          englishOptions: q.englishOptions || ["", "", "", ""],
          hindiOptions: q.hindiOptions || ["", "", "", ""],
          correctOptionIndex: Number(q.correctOptionIndex) || 0,
          englishExplanation:
            q.englishExplanation || "No explanation provided.",
          hindiExplanation: q.hindiExplanation || "कोई व्याख्या नहीं।",
          subject: ((uploadSubject.trim() || q.subject)?.trim().toLowerCase() === 'mathematics' ? 'Math' : (uploadSubject.trim() || q.subject)) || "Miscellaneous",
          difficulty: q.difficulty || "medium",
          createdAt: Date.now(),
        });
      }

      onNotify(`Successfully imported ${extracted.length} questions.`);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify("Failed to process document upload.", true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploading(false);
    }
  };

  const [showJsonSchema, setShowJsonSchema] = useState(false);

  const handleRawTextSubmit = async () => {
    if (!rawText.trim()) return;
    setUploading(true);
    setIsRawTextModalOpen(false);

    try {
      let extracted: any[] = [];
      let isDirectJson = false;

      try {
        const parsed = JSON.parse(rawText.trim());
        if (Array.isArray(parsed)) {
          extracted = parsed;
          isDirectJson = true;
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          extracted = parsed.questions;
          isDirectJson = true;
        }
      } catch (err) {
        // Not valid JSON, proceed with AI
      }

      if (isDirectJson) {
        onNotify(`Detected valid JSON. Processing ${extracted.length} questions directly...`);
      } else {
        const rawLines = rawText.split('\n');
        const processedLines = [];
        for (const line of rawLines) {
           if (line.length > 3000) {
             let remaining = line;
             while (remaining.length > 0) {
               processedLines.push(remaining.substring(0, 3000));
               remaining = remaining.substring(3000);
             }
           } else {
             processedLines.push(line);
           }
        }

        const textChunks = [];
        let currChunk = [];
        let currLen = 0;
        for (const line of processedLines) {
           currChunk.push(line);
           currLen += line.length + 1;
           if ((currLen > 3000 && (line.trim() === '' || !!line.match(/^Q\d+\./i))) || currLen > 5000) {
              textChunks.push(currChunk.join('\n'));
              currChunk = [];
              currLen = 0;
           }
        }
        if (currChunk.length > 0) textChunks.push(currChunk.join('\n'));

        onNotify(`Processing pasted text via AI in ${textChunks.length} chunks. Please wait...`);

        for (let i = 0; i < textChunks.length; i++) {
           if (i > 0) {
             onNotify(`Processing chunk ${i+1} of ${textChunks.length}... (cooldown)`);
             await new Promise(res => setTimeout(res, 4500));
           } else {
             onNotify(`Processing chunk ${i+1} of ${textChunks.length}...`);
           }
           
           try {
             const response = await fetch("/api/admin/extract-questions-raw", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ rawText: textChunks[i], languageMode }),
             });
             
             if (response.ok) {
               const data = await response.json();
               if (data.success && data.questions) {
                 extracted.push(...data.questions);
               }
             }
           } catch(e) {
             console.error(`Chunk ${i+1} failed`, e);
           }
        }
      }

      onNotify(`Saving ${extracted.length} questions to database...`);

      for (const q of extracted) {
        const qId =
          "qb_" + Date.now() + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, "questionBank", qId), {
          id: qId,
          englishQuestion: q.englishQuestion || "Missing English Context",
          hindiQuestion: q.hindiQuestion || "हिंदी अनुवाद उपलब्ध नहीं है",
          englishOptions: q.englishOptions || ["", "", "", ""],
          hindiOptions: q.hindiOptions || ["", "", "", ""],
          correctOptionIndex: Number(q.correctOptionIndex) || 0,
          englishExplanation:
            q.englishExplanation || "No explanation provided.",
          hindiExplanation: q.hindiExplanation || "कोई व्याख्या नहीं।",
          subject: ((uploadSubject.trim() || q.subject)?.trim().toLowerCase() === 'mathematics' ? 'Math' : (uploadSubject.trim() || q.subject)) || "Miscellaneous",
          difficulty: q.difficulty || "medium",
          createdAt: Date.now(),
        });
      }

      onNotify(`Successfully imported ${extracted.length} pasted questions.`);
      setRawText("");
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify("Failed to process pasted text extraction.", true);
    } finally {
      setUploading(false);
    }
  };

  const handleSeedPDFQuestions = async () => {
    const pdfQuestions: Partial<BankQuestion>[] = [
      {
        englishQuestion:
          "A is 24 years old. In 12 years, A will complete 5 tasks per year. How many tasks will A have completed altogether after 12 years?",
        hindiQuestion:
          "A 24 वर्ष का है। 12 वर्षों में, A प्रति वर्ष 5 कार्य पूरे करेगा। 12 वर्षों के बाद A ने कुल कितने कार्य पूरे किए होंगे?",
        englishOptions: ["60", "59", "65", "55"],
        hindiOptions: ["60", "59", "65", "55"],
        correctOptionIndex: 0,
        englishExplanation: "Each year, task: 5. For 12 years: 12 × 5 = 60.",
        hindiExplanation:
          "प्रत्येक वर्ष कार्य: 5. 12 वर्षों के लिए: 12 × 5 = 60.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "A is 21 years old. In 13 years, A will complete 2 tasks per year. How many tasks will A have completed altogether after 13 years?",
        hindiQuestion:
          "A 21 वर्ष का है। 13 वर्षों में, A प्रति वर्ष 2 कार्य पूरे करेगा। 13 वर्षों के बाद A ने कुल कितने कार्य पूरे किए होंगे?",
        englishOptions: ["28", "24", "26", "27"],
        hindiOptions: ["28", "24", "26", "27"],
        correctOptionIndex: 2,
        englishExplanation: "Each year, task: 2. For 13 years: 13 × 2 = 26.",
        hindiExplanation:
          "प्रत्येक वर्ष कार्य: 2. 13 वर्षों के लिए: 13 × 2 = 26.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "Ages of 3 people Kalpana, Sanjana, Divya are in AP. Their current sum is 54. After 5 years, sum will be 69. Find the youngest person's age.",
        hindiQuestion:
          "3 लोगों - कल्पना, संजना, दिव्या की आयु AP (समांतर श्रेणी) में है। उनका वर्तमान योग 54 है। 5 वर्ष बाद, योग 69 होगा। सबसे कम उम्र के व्यक्ति की आयु ज्ञात कीजिए।",
        englishOptions: ["16", "18", "17", "20"],
        hindiOptions: ["16", "18", "17", "20"],
        correctOptionIndex: 0,
        englishExplanation:
          "In AP, sum increases by 3×5=15. Current ages form AP starting with 16.",
        hindiExplanation:
          "AP में, योग 3×5=15 से बढ़ता है। वर्तमान आयु 16 से शुरू होने वाली AP बनाती है।",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "A car travels 180 km at 60 km/h. The driver's age is 2 times the travel time in hours. How old is the driver?",
        hindiQuestion:
          "एक कार 60 किमी/घंटा की गति से 180 किमी की यात्रा करती है। चालक की आयु यात्रा के समय (घंटों में) की दोगुनी है। चालक की आयु कितनी है?",
        englishOptions: ["12", "11", "1", "6"],
        hindiOptions: ["12", "11", "1", "6"],
        correctOptionIndex: 3,
        englishExplanation:
          "Time = Distance/Speed = 180/60 = 3 hours. Driver's age = 3 × 2 = 6.",
        hindiExplanation:
          "समय = दूरी/गति = 180/60 = 3 घंटे। चालक की आयु = 3 × 2 = 6.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "Simple interest on ₹2850 at 8% for 4 years is ₹912. A's age is principal/100, B's age is interest/10. Find A+B's age.",
        hindiQuestion:
          "₹2850 पर 8% की दर से 4 वर्ष का साधारण ब्याज ₹912 है। A की आयु (मूलधन/100) है, B की आयु (ब्याज/10) है। A+B की आयु ज्ञात करें।",
        englishOptions: ["124", "238", "114", "119"],
        hindiOptions: ["124", "238", "114", "119"],
        correctOptionIndex: 3,
        englishExplanation:
          "A = 2850/100 = 28.5 (approx 28), B = 912/10 = 91.2 (approx 91). Sum = 119.",
        hindiExplanation:
          "A = 2850/100 = 28.5 (लगभग 28), B = 912/10 = 91.2 (लगभग 91)। योग = 119.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "In 5 years, Mahesh will be 2 times as old as Phalguni will be then. Phalguni's present age is 13. What is Mahesh's present age?",
        hindiQuestion:
          "5 वर्षों में, महेश की आयु फाल्गुनी की उस समय की आयु की दोगुनी होगी। फाल्गुनी की वर्तमान आयु 13 वर्ष है। महेश की वर्तमान आयु क्या है?",
        englishOptions: ["26", "36", "13", "31"],
        hindiOptions: ["26", "36", "13", "31"],
        correctOptionIndex: 3,
        englishExplanation: "Mahesh+5 = 2*(13+5) -> Mahesh = 2*(18)-5 = 31.",
        hindiExplanation: "महेश+5 = 2*(13+5) -> महेश = 2*(18)-5 = 31.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "The sum of A and B's ages is 35. Twice A's age minus B's age is 7. Find A's age.",
        hindiQuestion:
          "A और B की आयु का योग 35 है। A की आयु के दोगुने में से B की आयु घटाने पर 7 प्राप्त होता है। A की आयु ज्ञात कीजिए।",
        englishOptions: ["16", "14", "12", "21"],
        hindiOptions: ["16", "14", "12", "21"],
        correctOptionIndex: 1,
        englishExplanation:
          "A + B = 35; 2A - B = 7. Adding equations: 3A = 42, A = 14.",
        hindiExplanation:
          "A + B = 35; 2A - B = 7. समीकरणों को जोड़ने पर: 3A = 42, A = 14.",
        subject: "Reasoning",
        difficulty: "easy",
      },
      {
        englishQuestion:
          "In 2024, the Amara family consists of: Amara (48), Gunjan (43), Sarvesh (21), Delilah (16). What is Gunjan's current age?",
        hindiQuestion:
          "वर्ष 2024 में, अमारा परिवार में शामिल हैं: अमारा (48), गुंजन (43), सर्वेश (21), डेलाइला (16)। गुंजन की वर्तमान आयु क्या है?",
        englishOptions: ["45", "41", "48", "43"],
        hindiOptions: ["45", "41", "48", "43"],
        correctOptionIndex: 3,
        englishExplanation:
          "From the given relationships, Gunjan's age is explicitly given as 43.",
        hindiExplanation:
          "दिए गए संबंधों से स्पष्ट है कि गुंजन की आयु 43 वर्ष है।",
        subject: "Reasoning",
        difficulty: "hard",
      },
      {
        englishQuestion:
          "If A=1, ..., Z=26, what is the sum of the positions for the word DOG?",
        hindiQuestion:
          "यदि A=1, ..., Z=26, तो शब्द DOG के क्रमांकों का योग क्या है?",
        englishOptions: ["390", "293", "26", "28"],
        hindiOptions: ["390", "293", "26", "28"],
        correctOptionIndex: 2,
        englishExplanation: "D=4, O=15, G=7. Sum = 4 + 15 + 7 = 26.",
        hindiExplanation: "D=4, O=15, G=7. योग = 4 + 15 + 7 = 26.",
        subject: "Reasoning",
        difficulty: "hard",
      },
      {
        englishQuestion:
          "Ian is 18, Savita is 19. After 3 years, what is the ratio of their ages?",
        hindiQuestion:
          "इयान 18 वर्ष का है, सविता 19 वर्ष की है। 3 वर्ष बाद, उनकी आयु का अनुपात क्या होगा?",
        englishOptions: ["18:19", "19:18", "22:21", "21:22"],
        hindiOptions: ["18:19", "19:18", "22:21", "21:22"],
        correctOptionIndex: 3,
        englishExplanation:
          "After 3 years: Ian = 21, Savita = 22. Ratio = 21:22.",
        hindiExplanation: "3 वर्ष बाद: इयान = 21, सविता = 22. अनुपात = 21:22.",
        subject: "Reasoning",
        difficulty: "hard",
      },
    ];

    setLoading(true);
    try {
      for (const q of pdfQuestions) {
        const qId =
          "qb_" + Date.now() + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, "questionBank", qId), {
          id: qId,
          ...q,
          imageUrl: "",
          optionImageUrls: ["", "", "", ""],
          createdAt: Date.now(),
        });
      }
      onNotify("Successfully seeded 10 Reasoning questions from PDF!");
      fetchQuestions(true);
    } catch (err) {
      console.error(err);
      onNotify("Error seeding PDF questions", true);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslateForm = async () => {
    if (!formData.englishQuestion && !formData.hindiQuestion) {
      onNotify("Please provide at least a question in English or Hindi before translating.", true);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch("/api/admin/translate-explain-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: formData }),
      });

      if (!res.ok) {
        throw new Error("Translation request failed");
      }

      const data = await res.json();
      if (data.success && data.question) {
        setFormData((prev) => ({
          ...prev,
          englishQuestion: data.question.englishQuestion || prev.englishQuestion,
          hindiQuestion: data.question.hindiQuestion || prev.hindiQuestion,
          englishOptions: data.question.englishOptions || prev.englishOptions,
          hindiOptions: data.question.hindiOptions || prev.hindiOptions,
          englishExplanation: data.question.englishExplanation || prev.englishExplanation,
          hindiExplanation: data.question.hindiExplanation || prev.hindiExplanation,
          correctOptionIndex: data.question.correctOptionIndex ?? prev.correctOptionIndex,
          subject: data.question.subject || prev.subject,
          difficulty: data.question.difficulty || prev.difficulty,
        }));
        onNotify("Translated and explained successfully!");
      } else {
        onNotify("Failed to translate question.", true);
      }
    } catch (e) {
      console.error(e);
      onNotify("Error occurred during translation.", true);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.englishQuestion) {
      onNotify("English Question is required", true);
      return;
    }
    
    setIsSavingQuestion(true);

    try {
      const qId =
        editingId ||
        "qb_" + Date.now() + Math.random().toString(36).substring(2, 6);
      const payload = {
        id: qId,
        englishQuestion: formData.englishQuestion || "",
        hindiQuestion: formData.hindiQuestion || "",
        imageUrl: formData.imageUrl || "",
        optionImageUrls: formData.optionImageUrls || ["", "", "", ""],
        englishOptions: formData.englishOptions || ["", "", "", ""],
        hindiOptions: formData.hindiOptions || ["", "", "", ""],
        correctOptionIndex: Number(formData.correctOptionIndex) || 0,
        englishExplanation: formData.englishExplanation || "",
        hindiExplanation: formData.hindiExplanation || "",
        subject: (formData.subject?.trim().toLowerCase() === 'mathematics' ? 'Math' : formData.subject) || "Miscellaneous",
        difficulty: formData.difficulty || "medium",
        createdAt: formData.createdAt || Date.now(),
      };

      await setDoc(doc(db, "questionBank", qId), payload);

      // Cascade update to ongoing exam attempts (skip historical results to preserve past grades)
      if (editingId) {
        try {
          const { writeBatch } = await import("firebase/firestore");
          
          const qAtt = query(collection(db, "examAttempts"), where("questionIds", "array-contains", qId));
          const attemptsSnap = await getDocs(qAtt);

          
          let totalUpdated = 0;
          const operations: { ref: any, data: any }[] = [];

          const processSnapshot = (snap: any) => {
              snap.forEach((d: any) => {
                  let needsUpdate = false;
                  const data = d.data();
                  if (data.questionsList) {
                      const qIdx = data.questionsList.findIndex((q: any) => q.id === qId);
                      if (qIdx !== -1) {
                          data.questionsList[qIdx] = payload;
                          needsUpdate = true;
                      }
                  }
                  
                  // Recalculate score if it's graded
                  if (data.answers && data.questionsList) {
                      let cCount = 0;
                      let iCount = 0;
                      let uCount = 0;
                      data.questionsList.forEach((qItem: any) => {
                         const sel = data.answers[qItem.id];
                         let state = data.questionStates?.[qItem.id];
                         let effSel = sel;
                         if (state === 'review_ans' || state === 'review') { effSel = -1; }

                         if (effSel === undefined || effSel === null || effSel === -1) {
                            uCount++;
                         } else if (Number(effSel) === qItem.correctOptionIndex) {
                            cCount++;
                         } else {
                            iCount++;
                         }
                      });
                      
                      data.correctCount = cCount;
                      data.incorrectCount = iCount;
                      data.unansweredCount = uCount;
                      
                      if (data.positiveMarks !== undefined) {
                          const pos = data.positiveMarks || 1;
                          const neg = data.negativeMarks || 0;
                          const passP = data.passingPercentage || 50;
                          
                          const rawScore = (cCount * pos) - (iCount * neg);
                          const maxScore = data.totalQuestions * pos;
                          data.score = parseFloat(rawScore.toFixed(2));
                          data.maxScore = maxScore;
                          
                          let perc = Math.round((rawScore / maxScore) * 100);
                          perc = Math.max(0, perc);
                          data.percentage = perc;
                          data.passed = perc >= passP;
                      }
                  }
                  
                  if (needsUpdate) {
                      operations.push({ ref: d.ref, data });
                  }
              });
          };
          
          processSnapshot(attemptsSnap);
          
          if (operations.length > 0) {
             const CHUNK_SIZE = 15; // Kept lower to prevent 10MB payload limit errors per batch.
             for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
                 const chunk = operations.slice(i, i + CHUNK_SIZE);
                 const chunkBatch = writeBatch(db);
                 for (const op of chunk) {
                     chunkBatch.update(op.ref, op.data);
                 }
                 await chunkBatch.commit();
                 totalUpdated += chunk.length;
                 // Small delay to prevent write stream exhaustion
                 await new Promise(r => setTimeout(r, 400));
             }
             console.log(`Cascaded update to ${totalUpdated} existing records.`);
          }
        } catch (err) {
           console.error("Error cascading update", err);
        }
      }

      onNotify(`Question ${editingId ? "Updated" : "Added"} successfully.`);
      setIsModalOpen(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify("Error saving question", true);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  const deleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, "questionBank", id));
      onNotify("Question deleted.");
      fetchQuestions();
    } catch (err) {
      onNotify("Error deleting question.", true);
    } finally {
      setQuestionToDelete(null);
    }
  };

  const handleDeleteDuplicates = async () => {
    setIsDeletingDuplicates(true);
    let deletedCount = 0;
    try {
      const seen = new Set<string>();
      const toDelete: string[] = [];
      const dbh = questions.slice().sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)); // Keep newest
      for (const q of dbh) {
        if (!q.englishQuestion) continue;
        
        // Strictly check exact match for question, options, images, and explanations
        const key = JSON.stringify({
          eq: (q.englishQuestion || '').trim(),
          hq: (q.hindiQuestion || '').trim(),
          eo: (q.englishOptions || []).map(o => o.trim()),
          ho: (q.hindiOptions || []).map(o => o.trim()),
          ans: q.correctOptionIndex,
          img: q.imageUrl || null,
          oImg: q.optionImageUrls || [],
          ee: (q.englishExplanation || '').trim(),
          he: (q.hindiExplanation || '').trim()
        });

        if (seen.has(key)) {
          toDelete.push(q.id);
        } else {
          seen.add(key);
        }
      }
      
      if (toDelete.length === 0) {
        onNotify('No duplicate questions found.');
        return;
      }
      
      for (const id of toDelete) {
        await deleteDoc(doc(db, "questionBank", id));
        deletedCount++;
      }
      onNotify(`Successfully deleted ${deletedCount} duplicate questions.`);
      fetchQuestions();
    } catch(err) {
      console.error(err);
      onNotify('Error deleting duplicates.', true);
    } finally {
      setIsDeletingDuplicates(false);
    }
  };

  const handleAutoClassify = async () => {
    if (!questions.length) return;

    setClassifying(true);
    let changedCount = 0;
    let correctlyClassifiedCount = 0;
    let unassignedCount = 0;
    let apiErrorCount = 0;
    let lastApiError = "";

    const subjects = Array.from(
      new Set([
        ...questions.map((q) => q.subject || "Miscellaneous"),
        "Miscellaneous"
      ]),
    );

    try {
      // Chunk processing to avoid overwhelming the server
      const chunkSize = 20;
      for (let i = 0; i < questions.length; i += chunkSize) {
        const chunk = questions.slice(i, i + chunkSize);

        onNotify(
          `Classifying chunk ${i / chunkSize + 1} of ${Math.ceil(questions.length / chunkSize)}...`,
        );
        const res = await fetch("/api/admin/auto-classify-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: chunk, subjects }),
        });

        if (!res.ok) throw new Error("API Error");
        const { results } = await res.json();

        for (const item of results) {
          const existingQuestion = chunk.find((q) => q.id === item.id);
          if (!existingQuestion) continue;

          if (item.error) {
            unassignedCount++;
            apiErrorCount++;
            lastApiError = item.error;
            console.error("Classification error:", item.error);
          } else if (!item.suggestedSubject) {
            unassignedCount++;
          } else if (item.suggestedSubject === existingQuestion.subject) {
            correctlyClassifiedCount++;
          } else {
            await updateDoc(doc(db, "questionBank", item.id), {
              subject: item.suggestedSubject,
            });
            changedCount++;
          }
        }
      }

      const summaryMsg = `Classification Complete!
Total Processed: ${questions.length}
Subjects Changed: ${changedCount}
Already Correct: ${correctlyClassifiedCount}
Unassigned/Failed: ${unassignedCount}${apiErrorCount > 0 ? `\n\nWarning: Encountered API errors (${apiErrorCount}). Example: ${lastApiError}` : ""}`;
      console.log(summaryMsg);
      onNotify("Classification completed.");

      fetchQuestions();
    } catch (e) {
      console.error(e);
      onNotify("Classification encountered an error.", true);
    } finally {
      setClassifying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    try {
      setLoading(true);
      for (const id of selectedQuestionIds) {
        await deleteDoc(doc(db, "questionBank", id));
      }
      onNotify(`Successfully deleted ${selectedQuestionIds.length} questions.`);
      setSelectedQuestionIds([]);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify("Error deleting questions in bulk.", true);
    } finally {
      setLoading(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const term = searchTerm.toLowerCase();
    const matchTerm =
      q.englishQuestion?.toLowerCase().includes(term) ||
      q.subject?.toLowerCase().includes(term);
    const matchSub = filterSubject ? q.subject === filterSubject : true;
    const matchDiff = filterDifficulty
      ? q.difficulty === filterDifficulty
      : true;
    return matchTerm && matchSub && matchDiff;
  });

  return (
    <div className="space-y-6">
      {classifying && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="text-indigo-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-800">
              Auto-Classifying
            </h3>
            <p className="text-sm text-slate-500 text-center">
              Please wait while the AI analyzes and categorizes your questions.
              This may take a moment...
            </p>
          </div>
        </div>
      )}
      {uploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="text-blue-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-800">
              Generating Questions
            </h3>
            <p className="text-sm text-slate-500 text-center">
              Please wait while the AI processes your document and extracts
              questions. This may take a few moments...
            </p>
          </div>
        </div>
      )}
      {isDeletingDuplicates && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="text-amber-500 animate-spin" />
            <h3 className="text-lg font-bold text-slate-800">
              Removing Duplicates
            </h3>
            <p className="text-sm text-slate-500 text-center">
              Please wait while duplicate questions are being removed...
            </p>
          </div>
        </div>
      )}

      {isSavingQuestion && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="text-green-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-800">
              Saving Question
            </h3>
            <p className="text-sm text-slate-500 text-center">
              Please wait while the question details are being saved...
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Global Question Bank
          </h2>
          <p className="text-sm text-slate-500">
            Manage bilingual questions for examinations. Total:{" "}
            {questions.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded px-2 py-1.5 bg-slate-50 mr-2">
            <input
              type="text"
              placeholder="Target Subject (Optional)..."
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value)}
              className="text-xs bg-transparent outline-none w-40 text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 border border-slate-200 rounded px-3 py-1.5 bg-slate-50 mr-2">
            <span className="text-xs font-bold text-slate-500">AI Mode:</span>
            <select
              value={languageMode}
              onChange={(e) =>
                setLanguageMode(e.target.value as "bilingual" | "english")
              }
              className="text-xs bg-transparent font-medium text-blue-700 outline-none cursor-pointer"
            >
              <option value="bilingual">Bilingual</option>
              <option value="english">English Only</option>
            </select>
          </div>
          <button
            onClick={() => setIsRawTextModalOpen(true)}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
          >
            <Plus size={16} /> Paste Bulk Text
          </button>
          <button
            onClick={handleDeleteDuplicates}
            disabled={isDeletingDuplicates}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded text-xs transition"
          >
            <Trash2 size={16} /> Remove Duplicates
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                englishQuestion: "",
                hindiQuestion: "",
                englishOptions: ["", "", "", ""],
                hindiOptions: ["", "", "", ""],
                imageUrl: "",
                optionImageUrls: ["", "", "", ""],
                correctOptionIndex: 0,
                englishExplanation: "",
                hindiExplanation: "",
                subject: "Miscellaneous",
                difficulty: "medium",
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition shadow-sm"
          >
            <Plus size={16} /> Manual Entry
          </button>
          {selectedQuestionIds.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition shadow-sm"
            >
              <Trash2 size={16} /> Delete Selected ({selectedQuestionIds.length}
              )
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search questions or subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded focus:outline-blue-500"
          />
        </div>
        <div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="">All Subjects</option>
            {Array.from(
              new Set([
                ...questions.map((q) => q.subject || "Miscellaneous"),
              ]),
            )
              .filter(Boolean)
              .map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="">Any Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border !!border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-blue-500" size={18} />{" "}
            Loading bank...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            No questions found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-slate-500 font-bold text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={
                        selectedQuestionIds.length ===
                          filteredQuestions.length &&
                        filteredQuestions.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuestionIds(
                            filteredQuestions.map((q) => q.id),
                          );
                        } else {
                          setSelectedQuestionIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4">Question snippet (En)</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds((prev) => [...prev, q.id]);
                          } else {
                            setSelectedQuestionIds((prev) =>
                              prev.filter((id) => id !== q.id),
                            );
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 line-clamp-1">
                        {q.englishQuestion}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {q.hindiQuestion}
                      </div>
                      <div className="mt-2 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded w-fit border border-green-200">
                        {`Ans: Option ${Number(q.correctOptionIndex) + 1} - ${q.englishOptions?.[q.correctOptionIndex] || "N/A"}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-bold text-[10px]">
                        {q.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded font-bold text-[10px] uppercase ${
                          q.difficulty === "hard"
                            ? "bg-rose-100 text-rose-700"
                            : q.difficulty === "easy"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditingId(q.id);
                          setFormData({
                            ...q,
                            englishOptions: q.englishOptions || [
                              "",
                              "",
                              "",
                              "",
                            ],
                            hindiOptions: q.hindiOptions || ["", "", "", ""],
                            optionImageUrls: q.optionImageUrls || [
                              "",
                              "",
                              "",
                              "",
                            ],
                            englishExplanation: q.englishExplanation || "",
                            hindiExplanation: q.hindiExplanation || "",
                            imageUrl: q.imageUrl || "",
                            subject: q.subject || "Miscellaneous",
                            difficulty: q.difficulty || "medium",
                            correctOptionIndex: q.correctOptionIndex ?? 0,
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setQuestionToDelete(q.id)}
                        className="text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isRawTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">
                Paste Bulk Questions
              </h3>
              <button
                onClick={() => setIsRawTextModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4 flex justify-between items-start">
              <span>
                Paste your raw question text or direct JSON format. Our AI will
                extract raw text, or bypass AI if valid JSON is provided.
              </span>
              <button
                onClick={() => setShowJsonSchema(!showJsonSchema)}
                className="text-blue-600 font-bold hover:underline ml-2 flex-shrink-0"
              >
                {showJsonSchema ? "Hide JSON Schema" : "Show JSON Schema"}
              </button>
            </p>

            {showJsonSchema && (
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded p-4 overflow-x-auto text-xs font-mono text-slate-700">
                <p className="mb-2 font-bold text-slate-800">
                  Example JSON Array Format:
                </p>
                <pre>{`[
  {
    "englishQuestion": "Question here",
    "hindiQuestion": "Hindi Question here (optional)",
    "englishOptions": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "hindiOptions": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctOptionIndex": 1,
    "englishExplanation": "Explanation ...",
    "hindiExplanation": "Hindi explanation...",
    "subject": "Topic"
  }
]`}</pre>
              </div>
            )}
            
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="1. What is the powerhouse of the cell?\n(a) Nucleus (b) Mitochondria (c) Ribosome (d) ER\nExplanation: Mitochondria generates ATP..."
              className="w-full text-sm px-3 py-3 border border-slate-200 rounded-lg focus:outline-blue-500 resize-y mb-4"
            />
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Mode:</span>
                <select
                  value={languageMode}
                  onChange={(e) =>
                    setLanguageMode(e.target.value as "bilingual" | "english")
                  }
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-medium text-blue-700 outline-none cursor-pointer"
                >
                  <option value="bilingual">
                    Bilingual (Add Hindi Translation)
                  </option>
                  <option value="english">
                    English Only (Faster AI processing)
                  </option>
                </select>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsRawTextModalOpen(false)}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRawTextSubmit}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                  disabled={uploading || !rawText.trim()}
                >
                  {uploading ? "Processing..." : "Extract Questions with AI"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center z-10">
              <h3 className="font-bold text-lg text-slate-800">
                {editingId ? "Edit Bank Question" : "Create Bank Question"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-6 space-y-4">
              <div className="flex justify-between mb-2">
                <button
                  type="button"
                  onClick={handleTranslateForm}
                  disabled={isTranslating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs transition disabled:opacity-50"
                >
                  {isTranslating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  {isTranslating ? "Translating..." : "Translate & Explain with AI"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageInputs(!showImageInputs)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showImageInputs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {showImageInputs ? "Hide Image Links" : "Add Image Links"}
                </button>
              </div>

              {showImageInputs && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Main Question Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.imageUrl || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Provide a direct image URL (ends in .png, .jpg).{" "}
                    <b>Note: Google Drive share links will not work.</b>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    English Question *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.englishQuestion || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        englishQuestion: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hindi Question
                  </label>
                  <textarea
                    rows={3}
                    value={formData.hindiQuestion || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hindiQuestion: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500"
                  />
                </div>
              </div>

              {/* Options Grid */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Options (En & Hi)
                </label>
                {[0, 1, 2, 3].map((idx) => {
                  const isCorrect = Number(formData.correctOptionIndex) === idx;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${isCorrect ? "border-green-500 bg-green-50 ring-2 ring-green-200" : "border-slate-200"}`}
                    >
                      <div className="flex flex-col md:flex-row gap-4 mb-2">
                        <input
                          type="text"
                          placeholder={`English Opt ${idx + 1}`}
                          value={formData.englishOptions?.[idx] || ""}
                          onChange={(e) => {
                            const nu = [...(formData.englishOptions || [])];
                            nu[idx] = e.target.value;
                            setFormData({ ...formData, englishOptions: nu });
                          }}
                          className="flex-1 text-sm border rounded px-3 py-2 bg-white"
                          required
                        />
                        <input
                          type="text"
                          placeholder={`Hindi Opt ${idx + 1}`}
                          value={formData.hindiOptions?.[idx] || ""}
                          onChange={(e) => {
                            const nu = [...(formData.hindiOptions || [])];
                            nu[idx] = e.target.value;
                            setFormData({ ...formData, hindiOptions: nu });
                          }}
                          className="flex-1 text-sm border rounded px-3 py-2 bg-white"
                        />
                      </div>
                      {showImageInputs && (
                        <div>
                          <input
                            type="url"
                            placeholder={`Option ${idx + 1} Image URL (Optional)`}
                            value={formData.optionImageUrls?.[idx] || ""}
                            onChange={(e) => {
                              const nu = [
                                ...(formData.optionImageUrls || ["", "", "", ""]),
                              ];
                              nu[idx] = e.target.value;
                              setFormData({ ...formData, optionImageUrls: nu });
                            }}
                            className="w-full text-xs border rounded px-3 py-2 bg-white text-slate-600 focus:outline-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correct Opt Index (0-3)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    required
                    value={formData.correctOptionIndex ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        correctOptionIndex: Number(e.target.value),
                      })
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    list="subjectOptions"
                    placeholder="Type or select a subject..."
                    value={formData.subject || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <datalist id="subjectOptions">
                    {Array.from(
                      new Set([
                        ...questions.map((q) => q.subject || "Miscellaneous"),
                        formData.subject || "Miscellaneous",
                      ]),
                    )
                      .filter(Boolean)
                      .map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty || "medium"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficulty: e.target.value as any,
                      })
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    English Explanation
                  </label>
                  <textarea
                    rows={2}
                    value={formData.englishExplanation || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        englishExplanation: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hindi Explanation
                  </label>
                  <textarea
                    rows={2}
                    value={formData.hindiExplanation || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hindiExplanation: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modals */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
            <Trash2
              size={48}
              className="mx-auto text-rose-500 mb-4 opacity-80"
            />
            <h3 className="font-bold text-lg text-slate-800 mb-2">
              Delete Selected?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to permanently delete{" "}
              {selectedQuestionIds.length} questions?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={loading}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                {loading ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
            <Trash2
              size={48}
              className="mx-auto text-rose-500 mb-4 opacity-80"
            />
            <h3 className="font-bold text-lg text-slate-800 mb-2">
              Delete Question?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setQuestionToDelete(null)}
                className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteQuestion(questionToDelete)}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isAssetManagerOpen && (
        <AssetManagerModal
          onClose={() => setIsAssetManagerOpen(false)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
