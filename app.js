const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeAndDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};
initializeAndDbAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  // check user
  const userDetailsQuery = `select * from user where username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);
  if (userDetails !== undefined) {
    const isPasswordValid = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordValid) {
      //get JWT Token
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "anjana_secret");
      response.send({ jwtToken }); //Scenario 3
    } else {
      response.status(400);
      response.send(`Invalid password`); //Scenario 2
    }
  } else {
    response.status(400);
    response.send("Invalid user"); //Scenario 1
  }
});

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "anjana_secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); // Scenario 1
      } else {
        next(); //Scenario 2
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`); //Scenario 1
  }
}

const convertStateDbObject = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `select * from state;`;
  const getStates = await db.all(getStatesQuery);
  response.send(getStates.map((eachState) => convertStateDbObject(eachState)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `select * from state where state_id = ${stateId};`;
  const getStateDetails = await db.get(getStateDetailsQuery);
  response.send(convertStateDbObject(getStateDetails));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) 
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrict = await db.run(createDistrictQuery);
  response.send(`District Successfully Added`);
});

const convertDbObjectDistrict = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `select * from district where district_id=${districtId};`;
    const getDistrictByIdQueryResponse = await db.get(getDistrictByIdQuery);
    response.send(convertDbObjectDistrict(getDistrictByIdQueryResponse));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id = ${districtId};`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId};`;

    const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;
