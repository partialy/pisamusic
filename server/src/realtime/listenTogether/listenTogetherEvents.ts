export const listenTogetherClientEvents = {
  join: "listen:join",
  leave: "listen:leave",
  play: "listen:play",
  pause: "listen:pause",
  changeSong: "listen:change_song",
  seek: "listen:seek",
  ended: "listen:ended",
  sync: "listen:sync",
  updateRoom: "listen:update_room",
  queue: "listen:queue",
  kickMember: "listen:kick_member",
  transferHost: "listen:transfer_host",
} as const;
