/***** ShowQuestions Automation (question media via linked IDs; no category copying)
 * Copies Question text/notes/pronunciation guide/answer from Questions table,
 * and pulls Question-level attachments from Images/Audio tables using the
 * linked-record fields on the Questions row.
 *
 * Trigger: Automation on ShowQuestions
 * Input variable: recordId  (Airtable record ID from the trigger)
 ******************************************************************************/

// === CONFIG: update names to match your base if needed
const TABLES = {
  SHOW_QUESTIONS: "ShowQuestions",
  QUESTIONS: "Questions",
  IMAGES: "Images", // child table storing image files
  AUDIO: "Audio", // child table storing audio files
};

const LINK_FIELDS_ON_SQ = {
  QUESTION: "Question", // link on ShowQuestions → Questions
};

// Field on ShowQuestions to check if this is a tiebreaker
const SQ_FIELDS = {
  QUESTION_TYPE: "Question type",
};

// Fields on Questions
const QUESTION_FIELDS_ON_QUESTIONS = {
  TEXT: "Question text", // long text (rich)
  NOTES: "Notes", // long text (rich)
  PRON_GUIDE: "Pronunciation guide", // long text (rich)
  ANSWER: "Answer text", // single line text (for regular questions)
  TB_ANSWER: "Tiebreaker answer", // single line text (for tiebreakers)
  IMAGES_LINK: "Images", // linked records to Images table
  AUDIO_LINK: "Audio", // linked records to Audio table
};

// Attachment fields on child tables
const CHILD_IMAGE_FIELDS = {
  FILE: "Image attachment", // attachment field on Images
  ORDER: "Image order", // optional number
};
const CHILD_AUDIO_FIELDS = {
  FILE: "Audio attachment", // attachment field on Audio
  ORDER: "Audio order", // optional number
};

// Destination fields on ShowQuestions (script writes only if present)
const DEST_ON_SQ = {
  Q_TEXT: "Question text",
  Q_NOTES: "Notes",
  Q_PRON_GUIDE: "Pronunciation guide",
  Q_ANSWER: "Answer",
  Q_IMAGES: "Question image attachments",
  Q_AUDIO: "Question audio attachments",
};

// === Helpers
function hasField(table, name) {
  return table.fields.some((f) => f.name === name);
}
function get(cell) {
  return cell ?? null;
}
function toAttach(cellValue) {
  if (!Array.isArray(cellValue)) return [];
  return cellValue
    .filter((a) => a && a.url)
    .map((a) => ({ url: a.url, filename: a.filename || undefined }));
}

/** Fetch attachments from child table by specific record IDs (preserves Questions' link order).
 * If an ORDER field exists on the child table, that will override the linked order.
 */
async function fetchChildAttachmentsByIds({
  table,
  idsInOrder,
  fileField,
  maybeOrderField,
}) {
  if (!idsInOrder || idsInOrder.length === 0) return [];
  const useOrder = !!(maybeOrderField && hasField(table, maybeOrderField));

  const rows = [];
  for (const id of idsInOrder) {
    const r = await table.selectRecordAsync(id);
    if (!r) continue;
    const files = toAttach(r.getCellValue(fileField));
    if (!files.length) continue;
    const orderVal = useOrder ? r.getCellValue(maybeOrderField) : undefined;
    rows.push({
      files,
      order: typeof orderVal === "number" ? orderVal : undefined,
    });
  }

  if (useOrder) {
    rows.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      return ao - bo;
    });
  }
  return rows.flatMap((x) => x.files);
}

// === Main
const { recordId } = input.config();
if (!recordId) throw new Error("Missing input 'recordId'.");

const SQ = base.getTable(TABLES.SHOW_QUESTIONS);
const QUES = base.getTable(TABLES.QUESTIONS);
const IMGS = base.getTable(TABLES.IMAGES);
const AUD = base.getTable(TABLES.AUDIO);

const rec = await SQ.selectRecordAsync(recordId);
if (!rec) throw new Error(`ShowQuestions record not found: ${recordId}`);

// Check if this is a tiebreaker question
const questionType = rec.getCellValue(SQ_FIELDS.QUESTION_TYPE);
const isTiebreaker =
  questionType && String(questionType).toLowerCase() === "tiebreaker";

// Resolve Question link (take first if multi-linked)
const qLink = rec.getCellValue(LINK_FIELDS_ON_SQ.QUESTION);
const questionId = Array.isArray(qLink) && qLink.length ? qLink[0].id : null;

const dest = {};
let counts = { qImgs: 0, qAud: 0 };

// Collect linked child record IDs
let imagesLinkedIds = [];
let audioLinkedIds = [];

// Copy Question text/answer and collect linked child record IDs
if (questionId) {
  const question = await QUES.selectRecordAsync(questionId);
  if (question) {
    // Copy question text, notes, and pronunciation guide (same for all questions)
    if (hasField(SQ, DEST_ON_SQ.Q_TEXT))
      dest[DEST_ON_SQ.Q_TEXT] = get(
        question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.TEXT)
      );
    if (hasField(SQ, DEST_ON_SQ.Q_NOTES))
      dest[DEST_ON_SQ.Q_NOTES] = get(
        question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.NOTES)
      );
    if (hasField(SQ, DEST_ON_SQ.Q_PRON_GUIDE))
      dest[DEST_ON_SQ.Q_PRON_GUIDE] = get(
        question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.PRON_GUIDE)
      );
    // Copy answer - use tiebreaker fields if applicable
    if (hasField(SQ, DEST_ON_SQ.Q_ANSWER)) {
      if (isTiebreaker) {
        dest[DEST_ON_SQ.Q_ANSWER] = get(
          question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.TB_ANSWER)
        );
      } else {
        dest[DEST_ON_SQ.Q_ANSWER] = get(
          question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.ANSWER)
        );
      }
    }

    // Get linked media IDs
    const imgLinks =
      question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.IMAGES_LINK) || [];
    const audLinks =
      question.getCellValue(QUESTION_FIELDS_ON_QUESTIONS.AUDIO_LINK) || [];
    imagesLinkedIds = Array.isArray(imgLinks) ? imgLinks.map((l) => l.id) : [];
    audioLinkedIds = Array.isArray(audLinks) ? audLinks.map((l) => l.id) : [];
  } else {
    // Question record not found - clear fields
    if (hasField(SQ, DEST_ON_SQ.Q_TEXT)) dest[DEST_ON_SQ.Q_TEXT] = null;
    if (hasField(SQ, DEST_ON_SQ.Q_NOTES)) dest[DEST_ON_SQ.Q_NOTES] = null;
    if (hasField(SQ, DEST_ON_SQ.Q_PRON_GUIDE))
      dest[DEST_ON_SQ.Q_PRON_GUIDE] = null;
    if (hasField(SQ, DEST_ON_SQ.Q_ANSWER)) dest[DEST_ON_SQ.Q_ANSWER] = null;
  }
} else {
  // No Question link - clear fields
  if (hasField(SQ, DEST_ON_SQ.Q_TEXT)) dest[DEST_ON_SQ.Q_TEXT] = null;
  if (hasField(SQ, DEST_ON_SQ.Q_NOTES)) dest[DEST_ON_SQ.Q_NOTES] = null;
  if (hasField(SQ, DEST_ON_SQ.Q_PRON_GUIDE))
    dest[DEST_ON_SQ.Q_PRON_GUIDE] = null;
  if (hasField(SQ, DEST_ON_SQ.Q_ANSWER)) dest[DEST_ON_SQ.Q_ANSWER] = null;
}

// Question-level attachments via child tables (using linked IDs)
if (hasField(SQ, DEST_ON_SQ.Q_IMAGES)) {
  if (imagesLinkedIds.length) {
    const qImgs = await fetchChildAttachmentsByIds({
      table: IMGS,
      idsInOrder: imagesLinkedIds,
      fileField: CHILD_IMAGE_FIELDS.FILE,
      maybeOrderField: CHILD_IMAGE_FIELDS.ORDER, // optional
    });
    dest[DEST_ON_SQ.Q_IMAGES] = qImgs;
    counts.qImgs = qImgs.length;
  } else {
    dest[DEST_ON_SQ.Q_IMAGES] = [];
  }
}

if (hasField(SQ, DEST_ON_SQ.Q_AUDIO)) {
  if (audioLinkedIds.length) {
    const qAud = await fetchChildAttachmentsByIds({
      table: AUD,
      idsInOrder: audioLinkedIds,
      fileField: CHILD_AUDIO_FIELDS.FILE,
      maybeOrderField: CHILD_AUDIO_FIELDS.ORDER, // optional
    });
    dest[DEST_ON_SQ.Q_AUDIO] = qAud;
    counts.qAud = qAud.length;
  } else {
    dest[DEST_ON_SQ.Q_AUDIO] = [];
  }
}

// Update once
await SQ.updateRecordAsync(rec, dest);

// Expose debug values for the run log or later steps
output.set("isTiebreaker", isTiebreaker);
output.set("questionImagesCount", counts.qImgs);
output.set("questionAudioCount", counts.qAud);
output.set("imageRecordIdsUsed", imagesLinkedIds);
output.set("audioRecordIdsUsed", audioLinkedIds);
