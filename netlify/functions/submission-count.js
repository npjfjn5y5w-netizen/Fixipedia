const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";
const FORM_NAME = "origin-submission";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

async function netlifyFetch(path, token) {
  const response = await fetch(`${NETLIFY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Netlify API ${path} failed with ${response.status}`);
  }

  return response.json();
}

async function findOriginSubmissionForm(siteId, token) {
  if (process.env.NETLIFY_FORM_ID) {
    return { id: process.env.NETLIFY_FORM_ID };
  }

  const forms = await netlifyFetch(`/sites/${siteId}/forms`, token);
  return forms.find((form) => form.name === FORM_NAME || form.name === `form-${FORM_NAME}`);
}

function toFiniteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function countFromFormMetadata(form) {
  const possibleCounts = [
    form?.submission_count,
    form?.submissionCount,
    form?.submissions_count,
    form?.submissionsCount,
    form?.count
  ];

  for (const value of possibleCounts) {
    const count = toFiniteCount(value);
    if (count !== null) return count;
  }

  return null;
}

async function countSubmissions(formId, token) {
  const perPage = 100;
  let page = 1;
  let count = 0;

  while (page <= 25) {
    const submissions = await netlifyFetch(`/forms/${formId}/submissions?page=${page}&per_page=${perPage}`, token);
    if (!Array.isArray(submissions) || !submissions.length) break;

    count += submissions.length;
    if (submissions.length < perPage) break;
    page += 1;
  }

  return count;
}

exports.handler = async () => {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;

  if (!token || !siteId) {
    return json(200, { count: null, configured: false });
  }

  try {
    const form = await findOriginSubmissionForm(siteId, token);
    if (!form?.id) return json(200, { count: 0, configured: true });

    const metadataCount = countFromFormMetadata(form);
    const count = metadataCount !== null
      ? metadataCount
      : await countSubmissions(form.id, token);

    return json(200, { count, configured: true });
  } catch (error) {
    return json(200, { count: null, configured: false });
  }
};
