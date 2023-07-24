const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateUser } = require("./userCheck");
const router = express.Router();

module.exports = (db) => {
  router.get(`/info`, authenticateUser(db), (req, res) => {
    const user = req.user;
    db.query(
      `SELECT * FROM users WHERE id = ?`,
      [user.id],
      async (error, results) => {
        const user = {
          id: results[0].id,
          nickname: results[0].nickname,
          email: results[0].email,
          role: results[0].role,
          token: req.token,
        };
        if (error) return res.status(400).send(error);
        if (results.length > 0) {
          const userData = await getUser(user.id);
          res.status(200).json(userData);
        } else return res.status(500).send("토큰 만료");
      }
    );
  });

  router.post(`/checkpw`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const { password } = req.body;

    db.query(
      `SELECT * FROM users WHERE email = ?`,
      [user.email],
      async (error, results) => {
        const validPassword = await bcrypt.compare(
          password,
          results[0].password
        );
        if (error) return res.status(400).send(error);
        if (validPassword) return res.status(200).send("ok");
        else return res.status(202).send("failed");
      }
    );
  });

  router.post(`/update`, authenticateUser(db), async (req, res) => {
    const user = req.user;
    const { nickname, password } = req.body;
    const nicknameRegex = /^[a-zA-Z가-힣]{2,8}$/; // 영어, 한글 8글자 이내
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/; // 영어, 숫자 포함 8자리 이상
    if (!nicknameRegex.test(nickname)) {
      return res
        .status(400)
        .send("유저 닉네임은 한글, 영어만 사용해서 2~8글자로 정해주세요.");
    }
    if (!passwordRegex.test(password)) {
      return res
        .status(400)
        .send("패스워드는 영어와 숫자를 포함하여 8자리 이상으로 정해주세요.");
    }
    salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    db.query(
      `UPDATE users SET nickname = ?, password = ? WHERE id = ?`,
      [nickname, hashedPassword, user.id],
      async (error, results) => {
        if (results) {
          const updatedUser = await getUser(user.id);
          console.log("updatedUser : " + JSON.stringify(user));
          return res.status(200).json(updatedUser);
        }
      }
    );
  });

  async function getUser(id) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE id = ?`,
        [id],
        async (error, results) => {
          if (results) {
            const user = {
              id: results[0].id,
              nickname: results[0].nickname,
              email: results[0].email,
              role: results[0].role,
            };
            console.log("user : " + JSON.stringify(user));
            resolve(user);
          }
        }
      );
    });
  }
  return router;
};
