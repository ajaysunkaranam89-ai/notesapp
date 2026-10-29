const TITLE_MAX = 100;
const BODY_MAX = 2000;

function validateNote(input) {
  const title = typeof (input && input.title) === "string" ? input.title.trim() : "";
  const body = typeof (input && input.body) === "string" ? input.body.trim() : "";

  if (!title) return { ok: false, error: "title is required" };
  if (title.length > TITLE_MAX) return { ok: false, error: `title must be at most ${TITLE_MAX} characters` };
  if (body.length > BODY_MAX) return { ok: false, error: `body must be at most ${BODY_MAX} characters` };

  return { ok: true, value: { title, body } };
}

module.exports = { validateNote, TITLE_MAX, BODY_MAX };
