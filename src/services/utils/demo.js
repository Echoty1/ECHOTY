// src/utils/demo.js
export const DEMO_TARGET_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
export const DEMO_TARGET_NAME = 'ECHO Support';
export const DEMO_TARGET_AVATAR = ''; // optional

export const isDemoUser = (user) => {
  return user && user.isDemo === true;
};

export const isDemoTarget = (uid) => {
  return uid === DEMO_TARGET_UID;
};