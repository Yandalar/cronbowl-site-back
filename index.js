"use strict";
const express = require("express");
const postgres = require("postgres");
const axios = require("axios");
const { addAsync } = require("@awaitjs/express");
const cors = require("cors");

// Create the express app
const app = express();
app.use(cors());
addAsync(app);
const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

const updateLeague = async () => {
  console.log("Estamos consultando las ligas");
  const request = await axios.get(
    "https://www.mordrek.com:666/api/v1/queries?req={%22leagueComps%22:{%22id%22:%22leagueComps%22,%22idmap%22:{%22idleague%22:%22926%22},%22filters%22:null,%22ordercol%22:%22active%20desc,last_game%22,%22order%22:%22desc%22,%22limit%22:null,%22from%22:0,%22group%22:null,%22aggr%22:null}}"
  );
  const response = request.data;
  const data = response.response.leagueComps.result.rows;
  console.log(data);

  await sql`
    INSERT INTO competitions ${sql(
      data.map(
        ([
          idcompetition,
          idorigin,
          competition_origin_id,
          competition_name,
          idleague,
          active,
          format,
          last_game,
          num_coaches,
          num_teams,
          num_games,
          sorting,
          turn_duration,
          last_checked,
        ]) => ({
          id: idcompetition,
          competition_name: competition_name,
        })
      )
    )}
    ON CONFLICT (id)
    DO
      UPDATE SET competition_name = EXCLUDED.competition_name;
  `;
  console.log("Insert en la base de datos terminado");

  for (const [
    idcompetition,
    idorigin,
    competition_origin_id,
    competition_name,
    idleague,
    active,
    format,
    last_game,
    num_coaches,
    num_teams,
    num_games,
    sorting,
    turn_duration,
    last_checked,
  ] of data) {
    await updateCompetition(idcompetition);
    await updateTeams(idcompetition);
  }
};

const updateCompetition = async (idcompetition) => {
  console.log(`Obteniendo informacion de la competition ${idcompetition}`);
  const request = await axios.get(
    `https://www.mordrek.com:666/api/v1/queries?req={%22compStandings%22:{%22id%22:%22compStandings%22,%22idmap%22:{%22idcompetition%22:%22${idcompetition}%22},%22filters%22:null,%22ordercol%22:%22sorting%22,%22order%22:%22desc%22,%22limit%22:30,%22from%22:0,%22group%22:null,%22aggr%22:null}}`
  );
  const response = request.data;
  const data = response.response.compStandings.result.rows;
  console.log(data);

  if (data.length == 0) return;
  await sql`
  INSERT INTO standings ${sql(
    data.map(
      ([
        idstanding,
        idcompetition,
        ranking,
        points,
        sorting,
        active,
        wins,
        draws,
        losses,
        td,
        td_opp,
        td_diff,
        cas,
        cas_opp,
        cas_diff,
        concedes,
        team_value,
        kills,
        position,
        gp,
        idteam,
        idrace,
        team_name,
        logo,
        twitch,
        youtube,
        idcoach,
        coach_name,
      ]) => ({
        id: idstanding,
        idteam: idteam,
        race: idrace,
        team: team_name,
        coach: coach_name,
        points: points,
        tv: team_value,
        win: wins,
        draw: draws,
        lost: losses,
        id_competition: idcompetition,
      })
    )
  )}
  ON CONFLICT (id)
  DO
      UPDATE SET team = EXCLUDED.team, idteam = EXCLUDED.idteam, race = EXCLUDED.race, coach = EXCLUDED.coach, points = EXCLUDED.points, tv = EXCLUDED.tv, win = EXCLUDED.win, draw = EXCLUDED.draw, lost = EXCLUDED.lost, id_competition = EXCLUDED.id_competition;
  `;
};
console.log("Insert en la base de datos terminado");

const updateTeams = async (idcompetition, idteam) => {
  console.log(`Obteniendo informacion de equipos en ${idcompetition}`);
  const request = await axios.get(
    `https://www.mordrek.com:666/api/v1/queries?req={%22compTeamPlayers%22:{%22id%22:%22compTeamPlayers%22,%22idmap%22:{%22idcompetition%22:%22${idcompetition}%22},%22idteam%22:%22${idteam}%22,%22filters%22:null,%22ordercol%22:%22number%22,%22order%22:%22asc%22,%22limit%22:50,%22from%22:0,%22group%22:null,%22aggr%22:%22sum%22}}`
  );

  const response = request.data;
  const data = response.response.compTeamPlayers.result.rows;
  console.log(data);

  if (data.length == 0) return;
  await sql`
    INSERT INTO teamPlayers ${sql(
      data.map(
        ([
          active,
          idteam,
          idplayer,
          player_origin_id,
          idplayertype,
          player_name,
          idleague,
          idcompetition,
          idorigin,
          ma,
          ag,
          av,
          st,
          skills,
          cas_state,
          cas_sustained,
          xp,
          xp_gain,
          level,
          number,
          td,
          run_meters,
          pass_meters,
          gp,
          passes,
          catches,
          completions,
          pushouts,
          blocks_for,
          breaks_for,
          stuns_for,
          kos_for,
          casualties_for,
          kills_for,
          blocks_against,
          breaks_against,
          stuns_against,
          kos_against,
          casualties_against,
          kills_against,
          turnovers,
          interceptions,
          expulsions,
        ]) => ({
          idteam: idteam,
          idplayer: idplayer,
          idplayertype: idplayertype,
          player_name: player_name,
          idcompetition: idcompetition,
          ma: ma,
          ag: ag,
          av: av,
          st: st,
          skills: skills,
          cas_sustained,
          xp_gain: xp_gain,
          level: level,
        })
      )
    )}
    ON CONFLICT (idplayer)
    DO
        UPDATE SET idteam = EXCLUDED.idteam, idplayertype = EXCLUDED.idplayertype, player_name = EXCLUDED.player_name, idcompetition = EXCLUDED.idcompetition, ma = EXCLUDED.ma, ag = EXCLUDED.ag, av = EXCLUDED.av, st = EXCLUDED.st, skills = EXCLUDED.skills, cas_sustained = EXCLUDED.cas_sustained, xp_gain = EXCLUDED.xp_gain, level = EXCLUDED.level;
  `;
};
console.log("Insert en la base de Players terminado");

app.get("/update", (req, res) => {
  updateLeague().then(() => {
    res.send("fin");
  });
});

app.getAsync("/data", async (req, res) => {
  const competitions = await sql`
  SELECT * FROM competitions 
  `;
  const standings = await sql`
  SELECT * FROM standings join races on standings.race = races.id join competitions on standings.id_competition = competitions.id
  `;

  const teamPlayers = await sql`
  SELECT teamPlayers.idteam, idplayer, idplayertype, player_name, idcompetition, ma, ag, av, st, skills, cas_sustained, xp_gain, level, team, competitions.competition_name, playertype.type
  FROM teamPlayers join standings on teamPlayers.idteam = standings.idteam join competitions on teamPlayers.idcompetition = competitions.id join playertype on teamPlayers.idplayertype = playertype.type_id
  `;

  res.send({ competitions, standings, teamPlayers });
});

// Routes and middleware
// app.use(/* ... */)
// app.get(/* ... */)

// Error handlers
app.use(function fourOhFourHandler(req, res) {
  res.status(404).send();
});
app.use(function fiveHundredHandler(err, req, res, next) {
  console.error(err);
  res.status(500).send();
});

// Start server
app.listen(Number(process.env.PORT), function (err) {
  if (err) {
    return console.error(err);
  }

  console.log(`Started at ${process.env.PORT}`);
});
