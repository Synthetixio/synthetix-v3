module.exports = async function exec(cmd, options) {
  return new Promise((resolve, reject) =>
    require('child_process').exec(
      cmd,
      { encoding: 'utf-8', stdio: 'pipe', ...options },
      (error, data) => (error ? reject(error) : resolve(data.trim()))
    )
  );
};
