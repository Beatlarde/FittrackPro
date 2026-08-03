require('dotenv').config();
const express = require('express');

const { helmetConfig, corsConfig, limiterGeneral, limiterIA, limiterEmail } = require('./middleware/security');
const { registerCrons } = require('./crons');

const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const plansRoutes = require('./routes/plans');
const premiumRoutes = require('./routes/premium');
const agentesRoutes = require('./routes/agentes');
const mediaRoutes = require('./routes/media');
const pagosWebhooksRoutes = require('./routes/pagos-webhooks');
const coachRoutes = require('./routes/coach');
const adminCoachRoutes = require('./routes/admin-coach');
const solicitudCoachRoutes = require('./routes/solicitud-coach');
const commsRoutes = require('./routes/comms');
const demoRoutes = require('./routes/demo');

const app = express();

app.use(helmetConfig);
app.use(corsConfig);
app.use(express.json({ limit: '10mb' }));

app.use('/api/', limiterGeneral);
app.use('/api/agente-entrenamiento', limiterIA);
app.use('/api/agente-nutricion', limiterIA);
app.use('/api/gemini', limiterIA);
app.use('/api/gemini-images', limiterIA);
app.use('/api/send-email', limiterEmail);

app.use('/api', healthRoutes);
app.use('/api', metricsRoutes);
app.use('/api', plansRoutes);
app.use('/api', premiumRoutes);
app.use('/api', agentesRoutes);
app.use('/api', mediaRoutes);
app.use('/api', pagosWebhooksRoutes);
app.use('/api', coachRoutes);
app.use('/api', adminCoachRoutes);
app.use('/api', solicitudCoachRoutes);
app.use('/api', commsRoutes);
app.use('/api', demoRoutes);

registerCrons();

app.listen(process.env.PORT, () => console.log('Backend en puerto ' + process.env.PORT));
