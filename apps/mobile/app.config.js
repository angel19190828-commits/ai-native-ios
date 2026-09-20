module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
