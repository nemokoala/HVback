const jwt = require("jsonwebtoken");

const authenticateUser = (db) => (req, res, next) => {
  //const authHeader = req.headers.authorization;
  //console.log(authHeader);
  // const token = authHeader;
  console.log(req.cookies.token);
  const token = req.cookies.token || "";

  if (!token) {
    return res.status(401).send("Access denied. No token provided.");
  }

  try {
    const payload = jwt.verify(token, process.env.SECRET_KEY);
    req.userId = payload.id; // 이 부분이 추가됨
    let user;
    db.query(
      `SELECT * FROM users WHERE id = ?`,
      [payload.id],
      (error, results) => {
        if (error) {
          res.status(500).send("db 에러");
          return;
        }
        user = results[0];
        req.user = results[0];
        req.token = token;
        next(); // 요청이 통과되면 다음 미들웨어나 핸들러로 이동
      }
    );
  } catch (ex) {
    res.status(500).send("500 failed");
    console.error(ex);
  }
};

module.exports = {
  authenticateUser,
};
