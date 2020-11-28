const env = require('../env');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

let DB = {};
let TRIUMPHS = {};
const UserInfoCache = {};
const UserCache = {};
const TriumphCache = {};

const PATHS = {
  DB: './db'
};

const HttpsOptions = {
  hostname: 'www.bungie.net',
  port: 443,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': env.bungie,
  }
};

const GetManifestAsync = () => new Promise((resolve, reject) => {
  console.log(env)
  const options = { 
    ...HttpsOptions, 
    path: '/Platform/Destiny2/Manifest/' 
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', _ => resolve(JSON.parse(body)));
    })
    .on('error', e => reject(e))
    .end();
});

const DownloadDbJsonAsync = (url, path) => new Promise((resolve, reject) => {
  if (fs.existsSync(path)) {
    const rawDB = fs.readFileSync(path);

    resolve(JSON.parse(rawDB));

    return;
  }

  const options = {
    ...HttpsOptions,
    path: url
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', _ => {
        fs.writeFileSync(path, body);
        resolve(JSON.parse(body));
      });
    })
    .on('error', e => reject(e))
    .end();
});

const GetUserProfileAsync = (membershipId, membershipType) => new Promise((resolve, reject) => {
  const userLookUpKey = `${membershipId}-${membershipType}`;

  if (UserCache[userLookUpKey]) {
    console.log(`${userLookUpKey} cached in UserCache`);
    resolve(UserCache[userLookUpKey]);
    return;
  }

  const options = { 
    ...HttpsOptions, 
    path: `/Platform/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,104,200,202,204,205,300,301,302,303,304,305,306,307,800,900` 
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      // res.on('end', _ => resolve(JSON.parse(body).Response));
      res.on('end', _ => {
        const response = JSON.parse(body).Response;
        UserCache[userLookUpKey] = response;
        resolve(UserCache[userLookUpKey]);
      });
    })
    .on('error', e => reject(e))
    .end();
});

const FolderCheck = path => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path)
  }
}

const SearchUserByDisplayNameAsync = displayName => new Promise((resolve, reject) => {
  if (UserInfoCache[displayName]) {
    console.log(`${displayName} cached in UserInfoCache`);
    resolve(UserInfoCache[displayName]);
    return;
  }

  const options = { 
    ...HttpsOptions, 
    path: `/Platform/Destiny2/SearchDestinyPlayer/-1/${encodeURIComponent(displayName)}/` 
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', _ => {
        const res = JSON.parse(body).Response;
        console.log(res);
        const response = JSON.parse(body).Response[0];
        UserInfoCache[displayName] = { membershipId: response.membershipId, membershipType: response.membershipType };
        resolve(UserInfoCache[displayName]);
      });
    })
    .on('error', e => reject(e))
    .end();
});

// const GetAccountRaidHistory = (membershipId, membershipType) => new Promise((resolve, reject) => {
//   const user = await GetUserProfileAsync(membershipId, membershipType);

//   const characterIds = Object.keys(user.data || {}).map(key => key);

//   await Promise.all(
//     characterIds.map(characterId => GetRaidHistory(membershipId, membershipType, characterId))
//   )
//   .then(res => resolve(res.flat()))
//   .catch(reject);
// });

const GetAccountRaidHistory = membershipId => new Promise((resolve, reject) => {
  const options = { 
    ...HttpsOptions, 
    hostname: `b9bv2wd97h.execute-api.us-west-2.amazonaws.com`,
    path: `/prod/api/player/${membershipId}`
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', _ => {
        const response = JSON.parse(body).response;
        
        resolve(response);
      });
    })
    .on('error', e => reject(e))
    .end();
});

const GetRaidHistory = (membershipId, membershipType, characterId) => new Promise((resolve, reject) => {
  const page = 0;
  const pageSize = 250;
  const mode = 4; // Raid = 4

  const options = { 
    ...HttpsOptions, 
    path: `/Platform/Destiny2/${membershipType}/Account/${membershipId}/Character/${characterId}/Stats/Activities/?page=${page}&mode=${mode}&count=${pageSize}`
  };
  https
    .request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', _ => {
        const response = JSON.parse(body).Response;
        
        resolve(response);
      });
    })
    .on('error', e => reject(e))
    .end();
});

async function StartUp() {
  console.log('D2.Startup running...');

  const manifest = await GetManifestAsync();
  const { Response: { jsonWorldContentPaths: { en: jsonWorldContentPath } } } = manifest;
  const fileName = jsonWorldContentPath.split('/').pop();
  const resolvedPath = path.resolve(PATHS.DB);

  FolderCheck(resolvedPath);

  const joinedPath = path.join(resolvedPath, fileName);

  DB = await DownloadDbJsonAsync(jsonWorldContentPath, joinedPath);

  ACTIVITIES = DB['DestinyActivityDefinition'];
  TRIUMPHS = DB['DestinyRecordDefinition'];

  Object.keys(TRIUMPHS).forEach(key => TriumphCache[TRIUMPHS[key].displayProperties.name] = key);

  console.log('D2.Startup Completed.');
}

const FindActivity = activityId => ACTIVITIES[activityId];

const FindTriumphId = triumphName => TriumphCache[triumphName];
const FindTriumph = triumphName => TRIUMPHS[FindTriumphId(triumphName)];

const PlayerCompletedTriumph = (user, triumph) => {
  const playerTriumph = PlayerTriumph(user, triumph);

  if (!triumph.hash || !playerTriumph)
    return null;

  return playerTriumph.objectives.map(objective => objective.complete).every(complete => complete);
}

const PlayerTriumph = (user, triumph) => {
  const Records = user['profileRecords']['data']['records'];

  if (!triumph.hash || !Records[triumph.hash])
    return null;

  return Records[triumph.hash]
}

const HasXMan = (activity, playerCount) => {
  if (activity.values.hasOwnProperty('bestPlayerCountDetails')) {
    if (activity.values.bestPlayerCountDetails.hasOwnProperty('accountCount'))
      return activity.values.bestPlayerCountDetails.activePlayerCount <= playerCount;

    return false;
  }

  return false;
}

const Has3Man = activity => HasXMan(activity, 3);
const Has2Man = activity => HasXMan(activity, 2);
const HasSolo = activity => HasXMan(activity, 1);

const MergeActivities = rrActivities => {
  const activities = {};

  rrActivities.forEach(activity => {
    const foundActivity = FindActivity(activity.activityHash);
    if (foundActivity) {
      let activityName = foundActivity.displayProperties.name.split(':')[0];
      const isLevi = activityName.split(',');
      if (isLevi.length != 1)
        activityName = isLevi.pop();
      if (!activities.hasOwnProperty(activityName))
        activities[activityName] = {
          hash: activity.activityHash,
          name: activityName.trim(),
          description: foundActivity.displayProperties.description,
          clears: 0, 
          flawless: false, 
          '2man': false, 
          '3man': false,
          solo: false,
        };

      activities[activityName].clears += activity.values.clears;
      activities[activityName].flawless = activities[activityName].flawless || activity.values.hasOwnProperty('flawlessDetails');
      activities[activityName]['2man'] = activities[activityName]['2man'] || Has2Man(activity);
      activities[activityName]['3man'] = activities[activityName]['3man'] || Has3Man(activity);
      activities[activityName].solo = activities[activityName].solo || HasSolo(activity);
    }
  });

  return activities;
}

const GetTotalClears = activities => Object.keys(activities).reduce((total, key) => total += activities[key].clears, 0); 

const POINTS = {
  // Raids
  'Spire of Stars:flawless': { min: 150, include: true },
  'Scourge of the Past:flawless': { min: 80, include: true },
  'Leviathan:flawless': { min: 105, include: true },
  'Eater of Worlds:flawless': { min: 80, include: true },
  'Last Wish:flawless': { min: 100, include: true },
  'Crown of Sorrow:flawless': { min: 75, include: true },
  'Shattered Throne:flawless': { min: 300, include: true },
  'Shattered Throne:solo': { min: 100, include: true },
  'Eater of Worlds:solo': { min: 200, include: true },
  'Leviathan:2man': { min: 100, include: true },
  'Eater of Worlds:2man': { min: 125, include: true },
  'Scourge of the Past:2man': { min: 150, include: true },
  'Crown of Sorrow:2man': { min: 135, include: true },
  'Leviathan:3man': { min: 50, include: true },
  'Eater of Worlds:3man': { min: 50, include: true },
  'Last Wish:3man': { min: 100, include: true },
  'Scourge of the Past:3man': { min: 100, include: true },
  'Crown of Sorrow:3man': { min: 75, include: true },
  // Clear Points
  'Clears': { min: 3, include: true },
  // Triumphs
  'Solo-nely': { min: 100, include: true },
  'Seriously, Never Again': { min: 300, include: true },
  // Glory
  'Fabled': { min: 200, include: true },
  'Mythic': { min: 225, include: true },
  'Legend': { min: 400, include: true },
};

const RANKS = {
  'Unranked': { min: 0, color: ''},
  'Bronze': { min: 500, color: ''},
  'Silver': { min: 825, color: ''},
  'Gold': { min: 1250, color: ''},
  'Platinum': { min: 1700, color: ''},
  'Diamond': { min: 2200, color: ''},
  'Ascendant': { min: 3000, color: ''},
}

const GetRank = points => (Object.keys(RANKS).filter(rank => RANKS[rank].min <= points) || []).pop();

const CalculatePoints = (user, activities) => {
  const points = [];

  const raidPoints = Object
    .keys(activities)
    .reduce((total, activityKey) => total += Object
        .keys(activities[activityKey])
        .filter(key => !['hash', 'name', 'description', 'clears'].includes(key))
        .reduce((innerTotal, key) => {
          if (!activities[activityKey][key])
            return innerTotal;

          const POINT = POINTS[`${activities[activityKey].name}:${key}`];

          if (!POINT || !POINT.include)
            return innerTotal;

          console.log(`${activities[activityKey].name}:${key} => ${POINT.min}`);

          return innerTotal + POINT.min;
        }, 0)
    , 0);
  points.push(raidPoints);

  const clearTotal = GetTotalClears(activities);
  const clearPoints = Math.min(clearTotal * (POINTS['Clears'].include ? POINTS['Clears'].min : 1), 300);
  console.log(`${clearTotal} Clears => ${clearPoints}`);
  points.push(clearPoints);

  const triumphPoints = [
    'Solo-nely', 
    'Seriously, Never Again'
  ]
    .map(triumph => FindTriumph(triumph))
    .filter(triumph => triumph && PlayerCompletedTriumph(user, triumph))
    .map(triumph => {
      const POINT = POINTS[triumph.displayProperties.name];

      if (POINT.include) {
        console.log(`${triumph.displayProperties.name} => ${POINT.min}`);
      }

      return POINT.include ? POINT.min : 0;
    })
    .reduce((total, triumphPoint) => total += triumphPoint, 0);
  points.push(triumphPoints);

  const gloryTriumph = FindTriumph('Become Legend');
  const playerTriumph = PlayerTriumph(user, gloryTriumph);
  const playerRank = playerTriumph.objectives[0].progress;
  const gloryPoints = [
    'Fabled',
    'Mythic',
    'Legend'
  ]
    .filter(rank => GloryV2[rank](playerRank))
    .map(rank => {
      const POINT = POINTS[rank];

      if (POINT.include) {
        console.log(`Glory Rank: ${rank} => ${POINT.min}`);
      }

      return POINT.include ? POINT.min : 0;
    })
    .reduce((total, rankPoint) => total += rankPoint, 0);
  points.push(gloryPoints);

  return points.reduce((total, point) => total += point, 0);
}

const GloryV2 = {
  'Fabled': rank => rank >= 3,
  'Mythic': rank => rank >= 4,
  'Legend': rank => rank >= 5 ,
}

const Glory = {
  'Fabled': user => GetGloryProgression(user).currentProgress >= 2100,
  'Mythic': user => GetGloryProgression(user).currentProgress >= 3500,
  'Legend': user => GetGloryProgression(user).currentProgress >= 5500,
}

const GetGloryProgression = user => {
  if (!user)
    return { currentProgress: 0 };
  
  const Progressions = user['characterProgressions']['data']

  return Progressions[Object.keys(Progressions)[0]].progressions['2679551909'];
};

module.exports = {
  StartUp,
  FindTriumph,
  SearchUserByDisplayNameAsync,
  GetUserProfileAsync,
  PlayerCompletedTriumph,
  GetAccountRaidHistory,
  FindActivity,
  MergeActivities,
  GetTotalClears,
  CalculatePoints,
  GetRank,
  RANKS
};
