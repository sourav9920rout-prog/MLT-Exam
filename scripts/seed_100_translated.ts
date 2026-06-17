import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import { translate } from '@vitalets/google-translate-api';

const rawConfig = fs.readFileSync('./firebase-applet-config.json', 'utf-8');
const config = JSON.parse(rawConfig);
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function clean() {
  const q = query(collection(db, 'questionBank'), where('subject', '==', 'Special Test-1'));
  const snap = await getDocs(q);
  const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  
  const batches = chunk(snap.docs, 100);
  console.log(`Found ${snap.size} to delete in ${batches.length} batches`);
  for (const b of batches) {
    const batch = writeBatch(db);
    b.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }
}

const rawText = `Q1. Fruity or sweet odour urine is associated with:
(A) Phenylketonuria
(B) Ketoacidosis
(C) UTI with Proteus
(D) UTI with E. coli
Answer: (B) Ketoacidosis
___
Q2. Specific gravity of normal urine is mainly related to:
(A) Urea and Sodium
(B) Urea and Potassium
(C) Creatinine and Sodium
(D) Creatinine and Potassium
Answer: (A) Urea and Sodium
___
Q3. Double oxalate is the anticoagulant which contains:
(A) Sodium oxalate & Potassium oxalate
(B) Sodium oxalate & Ammonium oxalate
(C) Potassium oxalate & Ammonium oxalate
(D) Potassium oxalate & Magnesium oxalate
Answer: (C) Potassium oxalate & Ammonium oxalate
___
Q4. Normal CSF should contain:
(A) < 20 leucocytes/cmm
(B) < 5 leucocytes/cmm
(C) < 10 leucocytes/cmm
(D) 12–15 leucocytes/cmm
Answer: (B) < 5 leucocytes/cmm
___
Q5. A syndrome characterized by generalized dysfunction (reabsorptive defect) of proximal convoluted tubule with increased excretion of amino acid, glucose, bicarbonate and phosphate is:
(A) Liddle syndrome
(B) Gitelman syndrome
(C) Bartter syndrome
(D) Fanconi syndrome
Answer: (D) Fanconi syndrome
___
Q6. In a thick smear, number of malaria parasites present per microliter of blood is calculated from the following formula:
(A) Total leucocyte count × (No. of parasites/100)
(B) Total leucocyte count × (No. of parasites/200)
(C) Total leucocyte count × (No. of parasites/300)
(D) Total leucocyte count × (No. of parasites/400)
Answer: (B) Total leucocyte count × (No. of parasites/200)
___
Q7. Red cell inclusion body which is visualized by Romanowsky-stained smears is:
(A) Howell–Jolly Bodies
(B) Pappenheimer Bodies
(C) Heinz Bodies
(D) Cabot's Rings
Answer: (A) Howell–Jolly Bodies
___
Q8. Megaloblastic Anaemia results from the deficiency of:
(A) Vitamin A
(B) Vitamin D
(C) Vitamin C
(D) Vitamin B12
Answer: (D) Vitamin B12
___
Q9. Cooley's Anaemia is:
(A) β-Thalassemia Major
(B) β-Thalassemia Intermediate
(C) β-Thalassemia Minor
(D) Sickle Cell Anaemia
Answer: (A) β-Thalassemia Major
___
Q10. Lifespan of a Platelet is about:
(A) 2–4 days
(B) 7–10 days
(C) 15–20 days
(D) 20–30 days
Answer: (B) 7–10 days
___
Q11. Regulated mechanism of cell death that serves to eliminate unwanted and irreparably damaged cells with the least possible host reaction is called:
(A) Autophagy
(B) Pyroptosis
(C) Necroptosis
(D) Apoptosis
Answer: (D) Apoptosis
___
Q12. In case of alkali splashes on the skin, which reagent should be used after washing the affected skin with plenty of tap water?
(A) 5% Acetic acid
(B) 5% Sodium Carbonate solution
(C) Polyethylene Glycol (PEG) mixed with water
(D) Diluted Dettol solution
Answer: (A) 5% Acetic acid
___
Q13. For dealing with large amount of organic matter and blood spillage, recommended solution of Sodium Hypochlorite is:
(A) 1 g/L (1000 ppm) available chlorine
(B) 2 g/L (2000 ppm) available chlorine
(C) 4 g/L (4000 ppm) available chlorine
(D) 5 g/L (5000 ppm) available chlorine
Answer: (D) 5 g/L (5000 ppm) available chlorine
___
Q14. Interaction of vessels and platelets to form a platelet plug at the site of injury is called:
(A) Primary hemostasis
(B) Secondary hemostasis
(C) Fibrinolysis
(D) Inflammation
Answer: (A) Primary hemostasis
___
Q15. In urine glucose determination, if Benedict's qualitative test is positive and glucose strip test is negative, then fructose can be identified by:
(A) Osazone test
(B) Seliwanoff's test
(C) Orthotoluidine test
(D) Hay's test
Answer: (B) Seliwanoff's test
___
Q16. ______ is used to differentiate bacteria having metachromatic granules from other bacteria.
(A) Gram stain
(B) Acid-fast stain
(C) Albert stain
(D) Counter stain
Answer: (C) Albert stain
___
Q17. A single strand of DNA has limitless capacity to duplicate itself to form millions of copies. This is the principle of:
(A) USG
(B) ELISA
(C) RIA
(D) PCR
Answer: (D) PCR
___
Q18. Cardinal signs of inflammation are:
(A) Rubor, Tumor, Calor, Pallor
(B) Rubor, Tumor, Pallor, Dolor
(C) Rubor, Tumor, Calor, Dolor
(D) Rubor, Pallor, Calor, Dolor
Answer: (C) Rubor, Tumor, Calor, Dolor
___
Q19. FNAC stands for:
(A) Full Needle Aspirated Cells
(B) Full Needle Aspirated Cytology
(C) Fine Needle Aspiration Cytology
(D) Fine Needle Analysed Cells
Answer: (C) Fine Needle Aspiration Cytology
___
Q20. Choose the correct equation:
(A) MCV = Hb × 10 / RBC
(B) MCV = Hb × 100 / RBC
(C) MCV = PCV (%) × 10 / RBC
(D) MCV = PCV (%) × 100 / RBC
Answer: (C) MCV = PCV (%) × 10 / RBC
___
Q21. Fluoride bulb is used for the collection of whole blood for estimation of:
(A) Liver Function Tests
(B) Kidney Function Tests
(C) Lipid Profile
(D) Blood Glucose
Answer: (D) Blood Glucose
___
Q22. Recommended method of choice for estimation of Haemoglobin by International Committee for Standardization in Haematology is:
(A) Sahli's Acid Hematin Method
(B) WHO Haemoglobin Colour Scale
(C) Cyanmethemoglobin Method
(D) Oxyhemoglobin Method
Answer: (C) Cyanmethemoglobin Method
___
Q23. Langhans giant cells are seen in:
(A) Rheumatic Fever
(B) Malaria
(C) Xanthoma
(D) Tuberculosis
Answer: (D) Tuberculosis
___
Q24. Ziehl–Neelsen sputum smear is positive for Tuberculosis if sputum contains:
(A) At least 4,000 tubercle bacilli per mL
(B) 4,000–6,000 tubercle bacilli per mL
(C) 5,000–10,000 tubercle bacilli per mL
(D) More than 12,000 tubercle bacilli per mL
Answer: (A) At least 4,000 tubercle bacilli per mL
___
Q25. Red coloured stool is seen in all the following conditions except:
(A) Bleeding in upper GI tract
(B) Bleeding in large intestine
(C) Undigested tomatoes
(D) Undigested beets
Answer: (A) Bleeding in upper GI tract
___
Q26. Each Hemoglobin molecule is able to transport ______ molecules of oxygen.
(A) 2
(B) 1
(C) 3
(D) 4
Answer: (D) 4
___
Q27. In Malaria, the form of Plasmodium that is transmitted from mosquito to human is:
(A) Hypnozoite
(B) Merozoite
(C) Sporozoite
(D) Gametocyte
Answer: (C) Sporozoite
___
Q28. Which of the following leucocyte count will predominantly increase in allergic reactions?
(A) Eosinophils
(B) Neutrophils
(C) Monocytes
(D) Lymphocytes
Answer: (A) Eosinophils
___
Q29. Sodium Nitroprusside present on dipstick is used for measurement of:
(A) Glucose
(B) Protein
(C) Ketone bodies
(D) Urobilinogen
Answer: (C) Ketone bodies
___
Q30. Salah and Klima needles are used for:
(A) Bone marrow aspiration
(B) Renal biopsy
(C) Liver biopsy
(D) Lung biopsy
Answer: (A) Bone marrow aspiration
___
Q31. Which of the following cytokines induces fever?
(A) Interleukin-15
(B) Interleukin-14
(C) Interleukin-1
(D) Interleukin-13
Answer: (C) Interleukin-1
___
Q32. Supravital staining of red cells in Glucose-6-Phosphate Dehydrogenase deficiency demonstrates the presence of:
(A) Platelets
(B) Plasmodia
(C) Heinz bodies
(D) Rubriblasts
Answer: (C) Heinz bodies
___
Q33. QuantiFERON Gold test is used to detect:
(A) Tuberculosis
(B) Typhoid
(C) Dengue
(D) Malaria
Answer: (A) Tuberculosis
___
Q34. Paul-Bunnell test is done for:
(A) Typhoid fever
(B) Infectious mononucleosis
(C) Chickenpox
(D) Tuberculosis
Answer: (B) Infectious mononucleosis
___
Q35. Nitrite in a urine specimen suggests the presence of:
(A) Red blood cells
(B) Bacteria
(C) White blood cells
(D) Yeasts
Answer: (B) Bacteria
___
Q36. Human anatomical wastes are disposed of in:
(A) Yellow bag
(B) Red bag
(C) Blue bag
(D) Black bag
Answer: (A) Yellow bag
___
Q37. The point mutation leading to sickle cell anaemia occurs at:
(A) Sixth position in the beta chain of hemoglobin
(B) Sixth position in the alpha chain of myoglobin
(C) Sixth position in the alpha chain of hemoglobin
(D) Sixth position in the beta chain of myoglobin
Answer: (A) Sixth position in the beta chain of hemoglobin
___
Q38. All of the following CSF findings are present in Tuberculous meningitis except:
(A) Raised protein levels
(B) Low chloride levels
(C) Cobweb formation
(D) Raised sugar levels
Answer: (D) Raised sugar levels
___
Q39. Monosodium urate crystals in synovial fluid indicate:
(A) Rheumatoid arthritis
(B) Sore throat
(C) Gout
(D) Typhoid
Answer: (C) Gout
___
Q40. Normal liquefaction time of semen after ejaculation is:
(A) 20–30 minutes
(B) 15–20 seconds
(C) 1–2 hours
(D) 2–3 hours
Answer: (A) 20–30 minutes
___
Q41. All are causes of unconjugated hyperbilirubinemia EXCEPT:
(A) Glucose-6-Phosphate Dehydrogenase deficiency
(B) Thalassemia
(C) Gilbert's syndrome
(D) Biliary stricture
Answer: (D) Biliary stricture
___
Q42. Perl's Prussian Blue stain is used in Bone Marrow Aspiration to detect:
(A) Iron
(B) Calcium
(C) Magnesium
(D) Copper
Answer: (A) Iron
___
Q43. Which media is appropriate for transport of fecal specimen?
(A) Blood agar media
(B) Cary-Blair transport media
(C) Chocolate agar media
(D) MacConkey agar media
Answer: (B) Cary-Blair transport media
___
Q44. Which of the following Hepatitis viruses is associated with the highest mortality in pregnancy?
(A) Hepatitis A
(B) Hepatitis B
(C) Hepatitis E
(D) Hepatitis C
Answer: (C) Hepatitis E
___
Q45. Which of the following anticoagulants is present in a green-top vacutainer?
(A) Oxalate
(B) Heparin
(C) Sodium citrate
(D) Sodium fluoride
Answer: (B) Heparin
___
Q46. Russell's bodies and Dutcher bodies are seen in:
(A) Multiple myeloma
(B) Myelodysplastic syndrome
(C) Burkitt's lymphoma
(D) Chronic lymphocytic leukemia
Answer: (A) Multiple myeloma
___
Q47. Mentzer index is the ratio of:
(A) MCV / RBC
(B) MCH / RBC
(C) MCHC / RBC
(D) Hb / RBC
Answer: (A) MCV / RBC
___
Q48. CD19, CD20 and CD21 are markers for:
(A) T lymphocytes
(B) B lymphocytes
(C) Natural killer cells
(D) Plasma cells
Answer: (B) B lymphocytes
___
Q49. All of the following are basic steps in tissue processing except:
(A) Fixation
(B) Embedding
(C) Microtomy
(D) Depairing (Deparaffinization)
Answer: (D) Depairing (Deparaffinization)
___
Q50. Which of the following techniques is suitable for identifying DNA molecules in a sample?
(A) Northern blotting
(B) Western blotting
(C) Southern blotting
(D) Eastern blotting
Answer: (C) Southern blotting
___
Q51. Exposure of specimen to light can affect levels of:
(A) Proteins
(B) Bilirubin
(C) Triglycerides
(D) Cholesterol
Answer: (B) Bilirubin
___
Q52. The function of insulin is to:
(A) Increase lipolysis in adipose tissue
(B) Increase gluconeogenesis in liver
(C) Increase glycogenesis in liver
(D) Increase glycogenolysis in liver
Answer: (C) Increase glycogenesis in liver
___
Q53. Black appearance of pleural fluid indicates:
(A) Aspergillus niger infection
(B) Staphylococcus infection
(C) Streptococcal infection
(D) Klebsiella infection
Answer: (A) Aspergillus niger infection
___
Q54. In cirrhosis of liver, the ascitic fluid will be:
(A) Cloudy or turbid
(B) Bloody
(C) Milky
(D) Clear, straw coloured
Answer: (D) Clear, straw coloured
___
Q55. Fouchet's reagent does not contain:
(A) Trichloroacetic acid
(B) Lugol iodine
(C) Distilled water
(D) Ferric chloride
Answer: (B) Lugol iodine
___
Q56. Which of these is an abnormal urine crystal?
(A) Cysteine
(B) Triple phosphates
(C) Calcium carbonate
(D) Uric acid
Answer: (A) Cysteine
___
Q57. What would be the correct match of thyroid profile tests and their interpretation?
1. Low TSH, Normal FT4, High FT3
2. Low TSH, Normal FT4, Normal FT3
3. Low TSH, Low FT4
4. Normal TSH, Normal FT4
i. Euthyroid
ii. T3 toxicosis
iii. Secondary hypothyroidism
iv. Subclinical hyperthyroidism
(A) 1-ii, 2-iv, 3-iii, 4-i
(B) 1-i, 2-ii, 3-iii, 4-iv
(C) 1-iv, 2-ii, 3-iii, 4-i
(D) 1-ii, 2-iii, 3-i, 4-iv
Answer: (A) 1-ii, 2-iv, 3-iii, 4-i
___
Q58. Renin is secreted by:
(A) Interstitial cells of lungs
(B) GIT cells
(C) Juxtaglomerular cells of kidney
(D) Proximal tubular epithelial cells
Answer: (C) Juxtaglomerular cells of kidney
___
Q59. In Sahli's acid hematin method, concentration of HCl used is:
(A) N/5
(B) N/10
(C) N/50
(D) N/100
Answer: (B) N/10
___
Q60. The fixative for CNS tissues is:
(A) Formalin
(B) Osmium tetroxide
(C) Glutaraldehyde
(D) Alcohol
Answer: (A) Formalin
___
Q61. The pipette used for blood dilution during platelet count in Neubauer's counting chamber is:
(A) WBC pipette
(B) Sahli's pipette
(C) RBC pipette
(D) Pasteur pipette
Answer: (C) RBC pipette
___
Q62. Prolonged application of tourniquet during sample collection results in:
(A) Decreased level of analytes due to hemodilution
(B) Decreased level of analytes due to hemoconcentration
(C) Increased level of analytes due to hemoconcentration
(D) Increased level of analytes due to hemodilution
Answer: (C) Increased level of analytes due to hemoconcentration
___
Q63. Reticulocytosis is seen in:
(A) Aplastic anaemia
(B) Haemolysis
(C) Iron deficiency anaemia
(D) Myelosclerosis
Answer: (B) Haemolysis
___
Q64. What is the ratio of anticoagulant and blood in Westergren's method of ESR estimation?
(A) 1:2
(B) 2:3
(C) 3:1
(D) 1:4
Answer: (D) 1:4
___
Q65. Red cells with bull's-eye appearance are:
(A) Spherocytes
(B) Schistocytes
(C) Codocytes (Target cells)
(D) Echinocytes
Answer: (C) Codocytes
___
Q66. The process by which an article, surface or medium is freed of all living microorganisms either in vegetative or spore state is:
(A) Decontamination
(B) Asepsis
(C) Disinfection
(D) Sterilisation
Answer: (D) Sterilisation
___
Q67. Circular DNA molecules present in the cytoplasm of bacteria, capable of autonomous replication are:
(A) Episomes
(B) Plasmids
(C) Introns
(D) Codons
Answer: (B) Plasmids
___
Q68. Subsequent infection by the same parasite in the host is termed:
(A) Re-infection
(B) Secondary infection
(C) Cross infection
(D) Nosocomial infection
Answer: (A) Re-infection
___
Q69. Substance which when introduced parenterally into the body stimulates production of an antibody and reacts specifically with it is termed:
(A) Hapten
(B) Antigen
(C) Immunoglobulin
(D) Pathogen
Answer: (B) Antigen
___
Q70. Which immunoglobulin is responsible for anaphylactic type hypersensitivity?
(A) IgA
(B) IgG
(C) IgM
(D) IgE
Answer: (D) IgE
___
Q71. Which of the following tests is not based on the principle of agglutination reaction?
(A) Widal test
(B) Weil-Felix test
(C) Wassermann reaction
(D) Paul-Bunnell test
Answer: (C) Wassermann reaction
___
Q72. Which of the following is not an autoimmune disease?
(A) Rheumatoid arthritis
(B) AIDS
(C) Polyarteritis nodosa
(D) Pernicious anaemia
Answer: (B) AIDS
___
Q73. Rheumatic fever is caused by:
(A) Streptococcus pyogenes
(B) Staphylococcus aureus
(C) Streptococcus agalactiae
(D) Streptococcus anginosus
Answer: (A) Streptococcus pyogenes
___
Q74. Rice-water stools are caused by:
(A) Escherichia coli
(B) Salmonella typhi
(C) Clostridium botulinum
(D) Vibrio cholerae
Answer: (D) Vibrio cholerae
___
Q75. Chaga's disease is caused by:
(A) Trypanosoma cruzi
(B) Giardia lamblia
(C) Entamoeba histolytica
(D) Leishmania donovani
Answer: (A) Trypanosoma cruzi
___
Q76. Which of the following etiological agents of UTI is a Gram-positive organism?
(A) E. coli
(B) Klebsiella
(C) Pseudomonas
(D) Staphylococcus saprophyticus
Answer: (D) Staphylococcus saprophyticus
___
Q77. Paul-Bunnell test is done for laboratory diagnosis of:
(A) Kaposi's sarcoma-associated herpesvirus (KSHV)
(B) Infectious mononucleosis
(C) Epstein-Barr virus
(D) Chickenpox
Answer: (B) Infectious mononucleosis
___
Q78. Which media is used to differentiate between lactose and non-lactose fermenters?
(A) MacConkey agar
(B) Thayer-Martin medium
(C) Lowenstein-Jensen medium
(D) Basal media
Answer: (A) MacConkey agar
___
Q79. The route of transmission of which hepatitis is through the feco-oral route?
(A) Hepatitis A
(B) Hepatitis B
(C) Hepatitis C
(D) Hepatitis D
Answer: (A) Hepatitis A
___
Q80. In UTI, which colony count is considered significant?
(A) 10³/ml
(B) 10⁵/ml
(C) 10⁷/ml
(D) 10⁹/ml
Answer: (B) 10⁵/ml
___
Q81. "Dare to Dream" Contest is an initiative related to which field?
(A) MSME
(B) Agriculture
(C) Defence
(D) Science and Technology
Answer: (C) Defence
___
Q82. Which footballer won the Golden Boot Award in the FIFA World Cup 2022?
(A) Lionel Messi
(B) Kylian Mbappé
(C) Emiliano Martinez
(D) Angel Di Maria
Answer: (B) Kylian Mbappé
___
Q83. Who was named "2022 Person of the Year" by Time Magazine?
(A) Elon Musk
(B) Volodymyr Zelenskyy
(C) Joe Biden
(D) Xi Jinping
Answer: (B) Volodymyr Zelenskyy
___
Q84. New Jalpaiguri, which was in the news related to Vande Bharat Express, is located in:
(A) Assam
(B) West Bengal
(C) Andhra Pradesh
(D) Gujarat
Answer: (B) West Bengal
___
Q85. Which neighbouring country of India recently inaugurated its first-ever metro rail line?
(A) Bhutan
(B) Bangladesh
(C) Nepal
(D) Pakistan
Answer: (B) Bangladesh
___
Q86. Choose the incorrect acid–source pair:
(A) Citric acid — Lemon
(B) Lactic acid — Sour milk
(C) Oxalic acid — Ant sting
(D) Methanoic acid — Nettle sting
Answer: (C) Oxalic acid — Ant sting
___
Q87. Which of the following is an inexhaustible natural resource?
(A) Air
(B) Minerals
(C) Forests
(D) Coal
Answer: (A) Air
___
Q88. Which country has hosted the Commonwealth Games the most times?
(A) United Kingdom
(B) Canada
(C) Australia
(D) New Zealand
Answer: (C) Australia
___
Q89. Which among the following was previously known as Imperial Bank of India?
(A) State Bank of India
(B) Reserve Bank of India
(C) Punjab National Bank
(D) ICICI Bank
Answer: (A) State Bank of India
___
Q90. Which star is directly above the North Pole?
(A) Polaris
(B) Sirius
(C) Vega
(D) Capella
Answer: (A) Polaris
___
Q91. Which of the following memories is used in a digital camera?
(A) Virtual memory
(B) Flash memory
(C) Main memory
(D) Cache memory
Answer: (B) Flash memory
___
Q92. Which of the following memory units is considered the largest?
(A) Peta Byte
(B) Exa Byte
(C) Yotta Byte
(D) Zetta Byte
Answer: (D) Zetta Byte
___
Q93. System software acts as a bridge between hardware and ______ software.
(A) Management
(B) Processing
(C) Utility
(D) Application
Answer: (D) Application
___
Q94. To delete any number of rows and columns in MS Excel, the shortcut key is:
(A) Ctrl + –
(B) Ctrl + X
(C) Ctrl + Z
(D) Ctrl + Shift + X
Answer: (D) Ctrl + Shift + X
___
Q95. Which keyboard shortcut is used to perform "Undo" operation in MS Word?
(A) Alt + Z
(B) Alt + U
(C) Ctrl + U
(D) Ctrl + Z
Answer: (D) Ctrl + Z
___
Q96. Shortcut key to increase the font size by one point is:
(A) Ctrl + ]
(B) Ctrl + Shift + >
(C) Alt + ]
(D) Alt + [
Answer: (B) Ctrl + Shift + >
___
Q97. Web pages are saved in which of the following formats?
(A) http
(B) HTML
(C) DOC
(D) URL
Answer: (B) HTML
___
Q98. Which of the following is not a valid email address?
(A) rekha@menon@gmail.com
(B) Chitralekha_123@viks.in
(C) NARASIMHA@vikas.in
(D) Aniruddha.Banerjee@ma.in
Answer: (A) rekha@menon@gmail.com
___
Q99. ______ is a network security system that oversees the control of incoming and outgoing network traffic based on predetermined security rules.
(A) Firewall
(B) Antivirus
(C) VPN
(D) HTTPS
Answer: (A) Firewall
___
Q100. Which of the following is the file extension of MS Excel?
(A) .xlsx
(B) .xls
(C) .exls
(D) .exl
Answer: (A) .xlsx`;

async function wait(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function doTranslate(text: string) {
  for (let i=0; i<3; i++) {
     try {
       const res = await translate(text, { to: 'hi' });
       return res.text;
     } catch (e) {
       console.log("Translation failed, retrying...", e.message);
       await wait(1000 * (i+1));
     }
  }
  return text; // fallback
}

function parseQuestions(text: string) {
  const qs: any[] = [];
  const blocks = text.split(/___\n?/);
  
  let currentQ = 1;

  for (let i = 0; i < blocks.length; i++) {
    const content = blocks[i].trim();
    if (!content) continue;
    
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const englishQuestion = lines[0];
    
    let ansLine = "";
    const ops: string[] = [];
    
    for (let j = 1; j < lines.length; j++) {
       const l = lines[j];
       if (l.startsWith("Answer:")) {
           ansLine = l;
           break;
       }
       if (l.match(/^\([A-D]\)/)) {
           ops.push(l.substring(4).trim());
       } else if (ops.length > 0 && !ops[ops.length-1].match(/^Answer:/)) {
            ops[ops.length-1] += " " + l.trim();
       } else if (ops.length === 0 && !l.match(/^Answer:/)) {
           // might be part of question multi-line
       }
    }
    
    let correctIdx = 0;
    if (ansLine.includes("(A)")) correctIdx = 0;
    else if (ansLine.includes("(B)")) correctIdx = 1;
    else if (ansLine.includes("(C)")) correctIdx = 2;
    else if (ansLine.includes("(D)")) correctIdx = 3;

    qs.push({
      englishQuestion,
      englishOptions: [ops[0] || "A", ops[1] || "B", ops[2] || "C", ops[3] || "D"],
      englishExplanation: ansLine,
      correctOptionIndex: correctIdx,
      subject: "Special Test-1",
      difficulty: "medium",
      createdAt: Date.now() + currentQ
    });
    
    currentQ++;
  }
  return qs;
}

const parsed = parseQuestions(rawText);

async function run() {
   await clean();
   
   console.log("Parsed questions for Special Test-1: " + parsed.length);
   
   if (parsed.length > 0) {
      let count = 0;
      const { doc, setDoc } = await import('firebase/firestore');
      for (const q of parsed) {
          console.log(`Translating Q${count+1}...`);
          const hindiQuestion = await doTranslate(q.englishQuestion);
          const hindiOptions = await Promise.all(q.englishOptions.map(o => doTranslate(o)));
          const hindiExplanation = await doTranslate(q.englishExplanation);
          
          const qId = "qb_" + Date.now() + Math.random().toString(36).substring(2, 8);
          await setDoc(doc(db, "questionBank", qId), {
            id: qId,
            englishQuestion: q.englishQuestion,
            englishOptions: q.englishOptions,
            hindiQuestion,
            hindiOptions,
            englishExplanation: q.englishExplanation,
            hindiExplanation,
            correctOptionIndex: q.correctOptionIndex,
            subject: q.subject,
            difficulty: q.difficulty,
            createdAt: q.createdAt,
            optionImageUrls: ["", "", "", ""]
          });
          count++;
          if (count % 10 === 0) console.log("Added " + count);
      }
      console.log("Finished adding 100 translated questions. Assigned to Special Test-1.");
   }
   process.exit(0);
}

run();
