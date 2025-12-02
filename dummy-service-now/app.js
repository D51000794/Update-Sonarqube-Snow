
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/api/now/table/incident', (req, res) => {
  console.log('Incident received:', req.body);
  res.json({ result: { sys_id: 'dummy123', ...req.body } });
});

app.listen(4000, () => console.log('Dummy ServiceNow running on port 4000'));

