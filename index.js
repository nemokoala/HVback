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
const nodemailer = require("nodemailer");

let corsOptions = {
  origin: ["http://localhost:8080", "https://homereview.netlify.app"],
  credentials: true,
};
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
require("dotenv").config();
const db = mysql.createPool({
  host: process.env.SQL_HOST,
  port: process.env.SQL_PORT,
  user: "root",
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  charset: "utf8mb4",
});
const userRoutes = require("./user")(db);
app.use("/user", userRoutes);
const communityRoutes = require("./community")(db);
app.use("/community", communityRoutes);
const reviewRoutes = require("./review")(db);
app.use("/review", reviewRoutes);
const adminRoutes = require("./admin")(db);
app.use("/admin", adminRoutes);

const transporter = nodemailer.createTransport({
  host: "smtp.naver.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.N_EMAIL,
    pass: process.env.N_PASSWORD,
  },
  authMethod: "PLAIN",
});

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("SERVER ON");
});
app.get("/email", async (req, res) => {
  let verifyNum = Math.floor(Math.random() * 99999) + 10000;
  try {
    const info = await transporter.sendMail({
      from: process.env.N_EMAIL, // 보내는 사람 이메일
      to: "fdxguy2@gmail.com", // 수신자 이메일
      subject: "네이버 이메일로 보낸 메일", // 이메일 제목
      text: `안녕하세요, 홈뷰 인증 번호입니다. ${verifyNum} `, // 이메일 내용 (텍스트 형식)
      // html: '<p>안녕하세요, 네이버 이메일을 통해 보낸 메일입니다.</p>', // 이메일 내용 (HTML 형식)
    });
    console.log("이메일이 성공적으로 전송되었습니다:", info.messageId);
  } catch (error) {
    console.error("이메일 전송 중 오류가 발생했습니다:", error);
  }
});
app.post("/register", async (req, res) => {
  const { nickname, email, password } = req.body;
  const nicknameRegex = /^[a-zA-Z가-힣]{2,8}$/; // 영어, 한글 8글자 이내
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // 이메일 형식
  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/; // 영어, 숫자 포함 8자리 이상

  if (!nickname || !email || !password) {
    return res.status(400).send("빈칸을 모두 채워주세요.");
  }
  if (!nicknameRegex.test(nickname)) {
    return res
      .status(400)
      .send("유저 닉네임은 한글, 영어만 사용해서 2~8글자로 정해주세요.");
  }

  if (!emailRegex.test(email)) {
    return res.status(400).send("올바른 이메일 형식이 아닙니다.");
  }

  if (!passwordRegex.test(password)) {
    return res
      .status(400)
      .send("패스워드는 영어와 숫자를 포함하여 8자리 이상으로 정해주세요.");
  }
  try {
    salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const sqlQuery =
      "INSERT INTO users (nickname, email, password, role, verified, registerTime) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(
      sqlQuery,
      [nickname, email, hashedPassword, "MEMBER", false, new Date()],
      async (error, results) => {
        if (error) {
          if (error.code === "ER_DUP_ENTRY")
            return res.status(400).send("이미 가입된 이메일입니다.");
          res.status(400).send("회원가입 중 오류가 발생했습니다.");
        } else {
          //회원가입 완료
          console.log(results);
          let verifyNum = Math.floor(Math.random() * 99999) + 10000;
          try {
            const info = await transporter.sendMail({
              from: process.env.N_EMAIL, // 보내는 사람 이메일
              to: email, // 수신자 이메일
              subject: "홈뷰 인증 메일", // 이메일 제목
              text: `안녕하세요, 홈뷰 인증 번호입니다. 로그인 후 "${verifyNum}" 번호를 입력하여 가입을 완료해주세요. `, // 이메일 내용 (텍스트 형식)
              // html: '<p>안녕하세요, 네이버 이메일을 통해 보낸 메일입니다.</p>', // 이메일 내용 (HTML 형식)
            });
            console.log("이메일이 성공적으로 전송되었습니다:", info.messageId);
            //이메일 전송이 완료되면 확인db에 코드 추가
            db.query(
              "INSERT INTO verify (email, code, verifyTime) VALUES (?, ?, ?)",
              [email, verifyNum.toString(), new Date()],
              (error, results) => {
                if (error) return res.status(400).send(error);
              }
            );
          } catch (error) {
            console.error("이메일 전송 중 오류가 발생했습니다:", error);
          }
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
      console.log(results[0]);
      if (results[0].kakao === 1)
        return res.status(400).send("해당 계정은 카카오로 로그인 해주세요.");
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
        verified: results[0].verified,
      };
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.status(201).json({ ...user });
    }
  );
});

app.get(`/register/check/:email`, (req, res) => {
  const email = req.params.email;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // 이메일 형식
  if (!emailRegex.test(email)) {
    return res.status(400).send("올바른 이메일 형식이 아닙니다.");
  }

  db.query(`SELECT * FROM users WHERE email = ?`, [email], (error, results) => {
    if (error) return res.status(400).send(error);
    if (results.length > 0)
      return res.status(400).send("이미 가입된 이메일입니다.");
    else return res.status(200).send("ok");
  });
});

app.post(`/verify`, authenticateUser(db), (req, res) => {
  const user = req.user;
  const { verifyCode } = req.body;
  db.query(
    `SELECT * FROM verify WHERE email = ?`,
    [user.email],
    (error, results) => {
      if (error) return res.status(400).send(error);
      if (verifyCode !== results[0].code)
        return res.status(400).send("인증 번호가 일치하지 않습니다.");
      else {
        db.query(
          `UPDATE users SET verified = ? WHERE email = ?`,
          [true, user.email],
          (error, results) => {
            if (error) return res.status(400).send(error);
            db.query(
              `DELETE FROM verify WHERE email = ?`,
              [user.email],
              (error, results) => {
                if (error) return res.status(400).send(error);
              }
            );
            return res.status(200).send("ok");
          }
        );
      }
    }
  );
});

app.get(`/verify/resend`, authenticateUser(db), async (req, res) => {
  const user = req.user;
  let verifyNum = Math.floor(Math.random() * 99999) + 10000;

  db.query(
    `DELETE FROM verify WHERE email = ?`,
    [user.email],
    (error, results) => {
      if (error) return res.status(400).send(error);
    }
  );

  try {
    const info = await transporter.sendMail({
      from: process.env.N_EMAIL, // 보내는 사람 이메일
      to: user.email, // 수신자 이메일
      subject: "홈뷰 인증 메일", // 이메일 제목
      text: `안녕하세요, 홈뷰 인증 번호입니다. 로그인 후 "${verifyNum}" 번호를 입력하여 가입을 완료해주세요. `, // 이메일 내용 (텍스트 형식)
      // html: '<p>안녕하세요, 네이버 이메일을 통해 보낸 메일입니다.</p>', // 이메일 내용 (HTML 형식)
    });
    console.log("이메일이 성공적으로 전송되었습니다:", info.messageId);
    //이메일 전송이 완료되면 확인db에 코드 추가
    db.query(
      "INSERT INTO verify (email, code, verifyTime) VALUES (?, ?, ?)",
      [user.email, verifyNum.toString(), new Date()],
      (error, results) => {
        if (error) return res.status(400).send(error);
        res.status(200).send("재전송 완료");
      }
    );
  } catch (error) {
    console.error("이메일 전송 중 오류가 발생했습니다:", error);
  }
});

app.post("/kakao/auth", (req, res) => {
  const { nickname, email, password, sessionTime } = req.body;
  if (!email || !password) {
    return res.status(400).send("카카오 유저 정보를 받을 수 없습니다.");
  }

  db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email],
    async (error, results) => {
      if (error) throw error;

      if (results.length === 0) {
        try {
          salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          const sqlQuery =
            "INSERT INTO users (nickname, email, password, role, kakao, verified, registerTime) VALUES (?, ?, ?, ?, ?, ?, ?)";
          db.query(
            sqlQuery,
            [nickname, email, hashedPassword, "MEMBER", true, true, new Date()],
            (error, results) => {
              if (error) {
                if (error.code === "ER_DUP_ENTRY")
                  return res.status(400).send("이미 가입된 이메일입니다.");
                res.status(400).send("회원가입 중 오류가 발생했습니다.");
              } else {
                console.log(results);
                res.status(202).send("회원 가입이 완료되었습니다.");
              }
            }
          );
        } catch (error) {
          res.status(500).send("회원가입 중 오류가 발생했습니다.");
        }
      }
      if (results.length > 0) {
        const validPassword = await bcrypt.compare(
          password,
          results[0].password
        );
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
          kakao: results[0].kakao,
          verified: results[0].verified,
        };
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
        });
        res.status(201).json({ ...user });
      }
    }
  );
});
