const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { config } = require('dotenv');
const { jwt } = require('twilio');
const OpenAI = require('openai');

config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const { AccessToken } = jwt;
const { VideoGrant } = AccessToken;

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const systemPrompt = `You are Talience, an AI video interviewer helping hiring teams run structured, skills-based interviews. \n\n- Stay warm and encouraging while remaining professional. \n- Ask one focused question at a time. Reference the role requirements and the candidate's background where it helps. \n- Encourage the candidate to think aloud about trade-offs, metrics, and impact. \n- After each candidate response, provide concise feedback and follow up with a progressively deeper question. \n- If the candidate seems stuck, give them a helpful hint rather than moving on immediately.`;

const jobsFilePath = path.join(__dirname, 'data', 'jobs.json');

const loadJsonFile = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read ${filePath}`, error);
    return [];
  }
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/jobs', (_req, res) => {
  const jobs = loadJsonFile(jobsFilePath);
  res.json({ jobs });
});

app.post('/api/token', (req, res) => {
  const { identity, roomName } = req.body || {};

  if (!identity) {
    return res.status(400).json({ error: 'An identity is required to create a token.' });
  }

  if (!roomName) {
    return res.status(400).json({ error: 'A room name is required.' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    console.error('Missing Twilio credentials.');
    return res.status(500).json({ error: 'Twilio credentials are not configured on the server.' });
  }

  try {
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
    });

    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);

    res.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Failed to create Twilio token', error);
    res.status(500).json({ error: 'Unable to generate a Twilio access token.' });
  }
});

app.post('/api/interview/message', async (req, res) => {
  if (!openai) {
    return res.status(500).json({ error: 'OpenAI is not configured on the server.' });
  }

  const { history = [], candidateProfile = {} } = req.body || {};

  if (!Array.isArray(history)) {
    return res.status(400).json({ error: 'History must be an array of messages.' });
  }

  const safeHistory = history
    .filter((item) => item && typeof item.role === 'string' && typeof item.content === 'string')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }));

  const profileSegments = [];
  if (candidateProfile.name) {
    profileSegments.push(`Candidate name: ${candidateProfile.name}`);
  }
  if (candidateProfile.role) {
    profileSegments.push(`Target role: ${candidateProfile.role}`);
  }
  if (candidateProfile.jobTitle) {
    profileSegments.push(`Interview job posting: ${candidateProfile.jobTitle}`);
  }
  if (candidateProfile.yearsExperience) {
    profileSegments.push(`Experience: ${candidateProfile.yearsExperience}`);
  }
  if (candidateProfile.skills) {
    profileSegments.push(`Key skills: ${candidateProfile.skills}`);
  }

  const enrichedSystemPrompt = profileSegments.length
    ? `${systemPrompt}\n\nContext for this interview:\n- ${profileSegments.join('\n- ')}`
    : systemPrompt;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        { role: 'system', content: enrichedSystemPrompt },
        ...safeHistory,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({ error: 'The interview agent did not return a response.' });
    }

    res.json({ reply });
  } catch (error) {
    console.error('Failed to generate interview response', error);
    res.status(500).json({ error: 'Unable to generate interview response.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Talience interview server listening on port ${PORT}`);
});
