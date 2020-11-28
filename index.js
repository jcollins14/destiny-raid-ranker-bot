const Discord = require('discord.js');
const env = require('./env');
const D2 = require('./D2');
const Helpers = require('./Helpers');

const client = new Discord.Client();

const GenerateRandomHexColor = _ => `#${Math.floor(Math.random()*16777215).toString(16)}`;

async function main() {
  await D2.StartUp();

  client.on('ready', () => console.log('Running...'));

  client.on('message', async message => {
    if (message.author.bot)
      return;

    if (message.content.startsWith('!')) {
      let [
        action, 
        playerName, 
        ...triumphName
      ] = message.content.split(' ');
      action = action.replace('!', '');
      triumphName = triumphName.join(' ');

      switch (action) {
        case 'raid.report': {
          const userinfo = await D2.SearchUserByDisplayNameAsync(playerName);
          
          if (!userinfo) {
            message.channel.send(`Could not find user info.`);
            break;
          }

          const user = await D2.GetUserProfileAsync(userinfo.membershipId, userinfo.membershipType);

          if (!user) {
            message.channel.send(`Could not find user.`);
            break;
          }

          const RR = await D2.GetAccountRaidHistory(userinfo.membershipId);

          let responseMessage = `**Raid Report Lookup**: for ${playerName}`;

          const activities = D2.MergeActivities(RR.activities);
          const totalClears = D2.GetTotalClears(activities);

          const totalPoints = D2.CalculatePoints(user, activities);
          console.log(totalPoints);

          const rank = D2.GetRank(totalPoints);
          console.log(rank);

          const roleData = {
            name: rank,
            color: D2.RANKS[rank].color || GenerateRandomHexColor(),
            reason: '',
          };

          await AddRole(message, roleData, playerName);

          const rolesToRemove = Object.keys(D2.RANKS)
            .filter(k => k != rank)
            .map(k => message.guild.roles.find(r => r.name == k))
            .filter(r => r);

          if (rolesToRemove.length) {
            await RemoveRoles(message, rolesToRemove, playerName);
          }

          responseMessage += `\n**Score:** *${totalPoints}*\t**Rank:** *${rank}*\t**Total Clears:** *${totalClears}*`;

          Object.keys(activities).forEach(key => {
            const activity = activities[key];
            responseMessage = `${responseMessage}
**${activity.name}**
  **Clears:** *${activity.clears}*\t**Flawless:** *${activity.flawless}*\t**2man:** *${activity['2man']}*\t**3man:** *${activity['3man']}*`;
          })

          message.channel.send(responseMessage);

          break;
        }
        case 'triumph': {
          const userinfo = await D2.SearchUserByDisplayNameAsync(playerName);
          const user = await D2.GetUserProfileAsync(userinfo.membershipId, userinfo.membershipType);
          const triumph = D2.FindTriumph(triumphName);

          // Can't find Catalyst on profile?
          if (triumph) {
            const completed = D2.PlayerCompletedTriumph(user, triumph);
            message.channel.send(`**Triumph Lookup**: for ${playerName} \`\`\`diff\n${completed ? '+ ' : '- Not '}Completed!\n\`\`\`\n**${triumph.displayProperties.name}**\n*${triumph.displayProperties.description}*\n`, {
              embed: {
                thumbnail: {
                  url: `https://www.bungie.net${triumph.displayProperties.icon}`
                }
              }
            });

            const roleData = {
              name: triumph.displayProperties.name,
              color: GenerateRandomHexColor(),
              reason: triumph.displayProperties.description,
            };

            if (completed) {
              await AddRole(message, roleData);
            } else {
              await RemoveRole(message, roleData);
            }
          } else {
            message.channel.send(`Could not find triumph ${triumphName}.`);
          }
          break;
        }
        default: {
          message.channel.send('UnSupported Action');
          break;
        }
      }
    }
  });

  client.login(env.discord)
    .catch(err => {
      console.log(err);
    });
}

main();

const AddRole = async (message, roleData, nickname) => {
  if (message.guild.available) {
    let role = message.guild.roles.find(r => r.name == roleData.name);

    if (!role) {
      role = await message.guild.roles.create({ 
        data: {
          name: roleData.name,
          color: roleData.color,
        },
        reason: roleData.reason,
      });
    }

    await message.guild.members.find(member => member.nickname == nickname).roles.add(role);
  }
}

const RemoveRole = async (message, roleData, nickname) => {
  if (message.guild.available) {
    let role = message.guild.roles.find(r => r.name == roleData.name);

    await message.guild.members.find(member => member.nickname == nickname).roles.remove(role);
  }
}

const RemoveRoles = async (message, roles, nickname) => {
  await message.guild.members.find(member => member.nickname == nickname).roles.remove(roles);
}
