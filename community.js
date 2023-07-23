const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateUser } = require("./userCheck");
const router = express.Router();

module.exports = (db) => {
  router.post(`/add`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const { categoryId, title, content } = req.body;
    db.query(
      `INSERT INTO posting (userId, nickname, categoryId, title, content, postTime, hits, likes) VALUES (?,?,?,?,?,?,?,?) `,
      [user.id, user.nickname, categoryId, title, content, new Date(), 0, 0],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        if (results) return res.status(201).send("ok");
      }
    );
  });

  router.post(`/edit/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const postId = req.params.id;
    const { categoryId, title, content } = req.body;
    db.query(
      `UPDATE posting SET title = ?, content = ?, categoryId = ? WHERE userId = ? AND id = ?`,
      [
        title,
        content + `<br/>${new Date().toLocaleString()} 수정됨`,
        categoryId,
        user.id,
        postId,
      ],
      async (error, results) => {
        if (error) {
          console.error(error);
          return res.status(400).send(error);
        }
        if (results) return res.status(200).send("ok");
      }
    );
  });

  router.delete(`/delete/:page`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const pageId = req.params.page;
    let dbSQL = `DELETE from posting WHERE id = ? And userId = ?  `;
    if (user.role === "ADMIN") dbSQL = `DELETE from posting WHERE id = ?`;

    db.query(dbSQL, [pageId, user.id], (error, results) => {
      if (error) return res.status(400).send(error);
      if (results) return res.status(200).send("ok");
    });
  });

  router.get(`/list/:category/:page`, (req, res) => {
    const category = req.params.category;
    const page = req.params.page;
    let count;
    if (category === "0") {
      db.query(
        `SELECT COUNT(*) as count FROM ??`,
        ["posting"],
        (error, results) => {
          if (error) return res.status(400).srend(error);
          if (results) count = results[0].count;

          db.query(
            `SELECT * FROM posting ORDER BY id DESC LIMIT 10 OFFSET ?`,
            [page * 10],
            (error, results) => {
              if (error) return res.status(400).send(error);
              if (results)
                return res.status(200).json({
                  content: [...results],
                  totalPages: Math.ceil(count / 10),
                });
            }
          );
        }
      );
    } else if (category !== "0")
      db.query(
        `SELECT COUNT(*) AS count From ?? WHERE categoryID = ?`,
        ["posting", category],
        (error, results) => {
          if (error) return res.status(400).send(error);
          if (results) count = results[0].count;

          db.query(
            `SELECT * FROM ?? WHERE categoryId = ? ORDER BY id DESC LIMIT 10 OFFSET ?`,
            ["posting", category, page * 10],
            (error, results) => {
              if (error) return res.status(400).send(error);
              if (results)
                return res.status(200).json({
                  content: [...results],
                  totalPages: Math.ceil(count / 10),
                });
            }
          );
        }
      );
  });

  router.get(`/search/:category/:search/:page`, (req, res) => {
    const category = req.params.category;
    const keyword = req.params.search;
    const page = req.params.page;
    let count;
    if (category === "0") {
      db.query(
        `SELECT count(*) as count FROM ?? WHERE title LIKE ? OR content LIKE ?`,
        ["posting", `%${keyword}%`, `%${keyword}%`],
        (error, results) => {
          if (error) return res.status(400).send(error);
          if (results) count = results[0].count;

          db.query(
            `SELECT * FROM ??  WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC LIMIT 10 OFFSET ?`,
            ["posting", `%${keyword}%`, `%${keyword}%`, page * 10],
            (error, results) => {
              if (error) return res.status(400).send(error);
              if (results)
                return res.status(200).json({
                  content: [...results],
                  totalPages: Math.ceil(count / 10),
                });
            }
          );
        }
      );
    } else if (category !== "0") {
      db.query(
        `SELECT count(*) as count FROM ?? WHERE categoryId = ? AND (title LIKE ? OR content LIKE ?)`,
        ["posting", category, `%${keyword}%`, `%${keyword}%`],
        (error, results) => {
          if (error) return res.status(400).send(error);
          if (results) count = results[0].count;

          db.query(
            `SELECT * FROM ??  WHERE categoryId = ? AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT 10 OFFSET ?`,
            ["posting", category, `%${keyword}%`, `%${keyword}%`, page * 10],
            (error, results) => {
              if (error) return res.status(400).send(error);
              if (results)
                return res.status(200).json({
                  content: [...results],
                  totalPages: Math.ceil(count / 10),
                });
            }
          );
        }
      );
    }
  });

  router.get(`/:id`, (req, res) => {
    const postId = req.params.id;
    db.query(
      `UPDATE posting SET hits = hits + 1 WHERE id = ?`,
      [postId],
      (error, results) => {
        if (error) return res.status(400).send("서버 오류");
        db.query(
          `SELECT * FROM posting WHERE id = ?`,
          [postId],
          (error, results) => {
            if (error) return res.status(400).send(error);
            if (results) return res.status(200).send(results[0]);
          }
        );
      }
    );
  });

  router.get(`/:id/like/check`, authenticateUser(db), (req, res) => {
    const userId = req.user.id;
    const postId = req.params.id;

    db.query(
      `SELECT * FROM likes WHERE userId = ? AND postId = ?`,
      [userId, postId],
      (error, results) => {
        if (error) return res.status(400).send("서버 오류");

        const liked = results.length > 0;
        !liked
          ? res.status(201).send("좋아요 안함")
          : res.status(202).send("이미 좋아요 했음");
      }
    );
  });

  router.get("/:id/like", authenticateUser(db), (req, res) => {
    const userId = req.user.id;
    const postId = req.params.id;

    db.query(
      `SELECT * FROM likes WHERE userId = ? AND postId = ?`,
      [userId, postId],
      (error, results) => {
        if (error) return res.status(400).send("서버 오류");

        if (results.length === 0)
          db.query(
            "INSERT INTO likes (userId, postId) VALUES (?, ?)",
            [userId, postId],
            (error, results) => {
              if (error)
                return res
                  .status(400)
                  .send("좋아요 추가 중 오류가 발생했습니다.");

              db.query(
                `UPDATE posting SET likes = likes + 1 WHERE id = ?`,
                [postId],
                (error, results) => {
                  if (error) return res.status(400).send("서버 오류");
                  db.query(
                    `SELECT * FROM posting WHERE id = ?`,
                    [postId],
                    (error, results) => {
                      if (error) return res.status(400).send(error);
                      res.status(201).send("좋아요가 추가되었습니다.");
                    }
                  );
                }
              );
            }
          );
        else if (results.length > 0)
          db.query(
            `DELETE FROM likes WHERE userId = ? AND postId = ?`,
            [userId, postId],
            (error, results) => {
              if (error) return res.status(400).send(error);

              db.query(
                `UPDATE posting SET likes = likes - 1 WHERE id = ?`,
                [postId],
                (error, results) => {
                  if (error) return res.status(400).send("서버 오류");
                  db.query(
                    `SELECT * FROM posting WHERE id = ?`,
                    [postId],
                    (error, results) => {
                      if (error) return res.status(400).send(error);
                      return res.status(202).send("좋아요가 취소되었습니다.");
                    }
                  );
                }
              );
            }
          );
      }
    );
  });

  router.post(`/comment/add`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const { postId, content } = req.body;
    db.query(
      `INSERT INTO comments (postId, userId, nickname, content, commentTime) VALUES (?, ?, ?, ?, ?) `,
      [postId, user.id, user.nickname, content, new Date()],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        if (results) return res.status(201).send("ok");
      }
    );
  });

  router.get(`/comment/:id`, (req, res) => {
    const postId = req.params.id;
    db.query(
      `SELECT * FROM comments WHERE postId = ?`,
      [postId],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        if (results) return res.status(201).json(results);
      }
    );
  });

  router.delete(`/comment/:id/delete`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const commentId = req.params.id;
    db.query(
      `DELETE FROM comments WHERE userId = ? AND id = ?`,
      [user.id, commentId],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        if (results) return res.status(202).send("delete ok");
      }
    );
  });

  return router;
};
