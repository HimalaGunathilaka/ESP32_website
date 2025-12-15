const express = require("express");
const cors = require("cors");
const app = express();

var total_time = 0;
var start = 0;

app.use(cors());

app.get("/", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});


// Calculate focus time
app.post('/focus/start', (req,res) => {
  // start time
  res.json({status: 'started'});
  start = Date.now();
});

app.post('/focus/end',(req,res) =>{
  // Sum up the spent time
  const elapsed = Math.floor((Date.now() - start) / 1000);
  total_time += elapsed;
  res.json({total_time: total_time});
})

app.get('/focus/total', (req, res) =>{
  // Return current total time
  res.json({total_time: total_time});
});