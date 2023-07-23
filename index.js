const { authenticateUser } = require("./userCheck");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.port || 8000;
const bcrypt = require("bcryptjs");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

let corsOptions = {
  origin: "*",
  credentials: true,
};
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
require("dotenv").config();
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "2619",
  database: "homeview",
});
const userRoutes = require("./user")(db);
app.use("/user", userRoutes);
const communityRoutes = require("./community")(db);
app.use("/community", communityRoutes);
const reviewRoutes = require("./review")(db);
app.use("/review", reviewRoutes);
const adminRoutes = require("./admin")(db);
app.use("/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});

app.get("/", (req, res) => {
  const sqlQuery = `SELECT *FROM post`;
  db.query(sqlQuery, (err, result) => {
    console.log(result);
    res.send(result);
    console.log(err);
  });
});

app.post("/register", async (req, res) => {
  const { name, nickname, email, password } = req.body;
  if (!nickname || !email || !password) {
    return res.status(400).send("빈칸을 모두 채워주세요.");
  }
  if (nickname.length > 10)
    return res.status(400).send("유저 이름은 10글자 이내로 정해주세요.");
  try {
    salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const sqlQuery =
      "INSERT INTO users (name, nickname, email, password, role) VALUES (?, ?, ?, ?, ?)";
    db.query(
      sqlQuery,
      [name, nickname, email, hashedPassword, "MEMBER"],
      (error, results) => {
        if (error) {
          if (error.code === "ER_DUP_ENTRY")
            return res.status(400).send("이메일 또는 유저 이름이 중복됩니다.");
          res.status(500).send("회원가입 중 오류가 발생했습니다.");
        } else {
          console.log(results);
          res.status(201).send("회원 가입이 완료되었습니다.");
        }
      }
    );
  } catch (error) {
    res.status(500).send("회원가입 중 오류가 발생했습니다.");
  }
});

app.post("/login", (req, res) => {
  const { email, password, sessionTime } = req.body;
  if (!email || !password) {
    return res.status(400).send("유저이름 또는 패스워드를 입력해주세요.");
  }

  db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email],
    async (error, results) => {
      if (error) throw error;

      const validPassword = await bcrypt.compare(password, results[0].password);
      if (!validPassword)
        return res.status(401).send("유저이름 또는 비밀번호가 틀립니다.");

      const expiresIn = `${sessionTime}m`;
      const token = jwt.sign({ id: results[0].id }, process.env.SECRET_KEY, {
        expiresIn,
      });
      const user = {
        id: results[0].id,
        nickname: results[0].nickname,
        email: results[0].email,
        role: results[0].role,
        token: token,
      };
      res.status(201).json({ ...user });
    }
  );
});

app.get(`/register/check/:email`, (req, res) => {
  const email = req.params.email;
  db.query(`SELECT * FROM users WHERE email = ?`, [email], (error, results) => {
    if (error) return res.status(400).send(error);
    if (results.length > 0)
      return res.status(400).send("이미 가입된 이메일입니다.");
    else return res.status(200).send("ok");
  });
});
