require('discord.js');

const CreateRole = async (message, { name, color, reason }) => new Promise(async (resolve, reject) => {
  if (!message.guild.available) {
    return null;
  }  

  const foundRole = FindRoleByName(message, name);
  if (foundRole) {
    resolve(foundRole);
  }

  const newRole = await message.guild.roles.create({ data: { name, color }, reason });
  resolve(newRole);
});

const FindRoleByName = (message, roleName) => {
  if (!message.guild.available) {
    return null;
  }
  return message.guild.roles.filter(role => role.name = roleName)[0];
}

const GiveRoleToMemberByNickname = async (message, role, nickname) => {
  if (!message.guild.available) {
    return;
  }
  return await message.guild.members.find(member => member.nickname == nickname).roles.add(role.id);
}

const RemoveRoleFromMemberByNickname = async (message, role, nickname) => {
  if (!message.guild.available) {
    return;
  }
  const member = message.guild.members.find(member => member.nickname == nickname);
  
  console.log(role);

  console.log(member.roles);
  console.log(member.roles.find(r => r.id == role.id));

  const res = await member.roles.remove(role.id);
  // console.log(res);
  return res;
}

module.exports = {
  CreateRole,
  FindRoleByName,
  GiveRoleToMemberByNickname,
  RemoveRoleFromMemberByNickname,
};
