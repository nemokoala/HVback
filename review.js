const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateUser } = require("./userCheck");
const router = express.Router();
const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: "ap-northeast-2", // 예: 'us-west-2'
});

const s3 = new AWS.S3();

module.exports = (db) => {
  router.post(`/add`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const { room, pros, cons, score, imageUrl } = req.body;
    let count;
    let roomId;
    db.query(
      `SELECT * FROM room WHERE building = ? AND newAddress = ? AND oldAddress = ?`,
      [room.building, room.newAddress, room.oldAddress],
      (error, results) => {
        if (error) return res.status(400).send(error);
        count = results.length;
        if (count > 0) roomId = results[0].id;

        if (count === 0)
          db.query(
            `INSERT INTO room (building, newAddress, oldAddress, latitude, longitude, sido, sigungu, dong) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              room.building,
              room.newAddress,
              room.oldAddress,
              room.latitude,
              room.longitude,
              room.sido,
              room.sigungu,
              room.dong,
            ],
            (error, results) => {
              if (error) return res.status(400).send(error);
              roomId = results.insertId; // 새로 생성된 room의 id

              db.query(
                `INSERT INTO review (roomId, userId, nickname, pros, cons, score, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [roomId, user.id, user.nickname, pros, cons, score, imageUrl],
                (error, results) => {
                  if (error) return res.status(400).send(error);
                  return res.status(200).send("OK");
                }
              );
            }
          );

        if (count > 0)
          db.query(
            `SELECT * FROM review WHERE roomId = ? AND userId = ?`,
            [roomId, user.id],
            async (error, results) => {
              if (error) return res.status(400).send(error);
              if (results.length > 0) {
                if (imageUrl !== "") {
                  await deleteImageFromS3(
                    "homereview1",
                    imageUrl.split(".com/")[1]
                  );
                }

                return res.status(202).send("중복방");
              }

              db.query(
                `INSERT INTO review (roomId, userId, nickname, pros, cons, score, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [roomId, user.id, user.nickname, pros, cons, score, imageUrl],
                (error, results) => {
                  if (error) return res.status(400).send(error);
                  return res.status(200).send("OK");
                }
              );
            }
          );
      }
    );
  });

  router.get(`/all`, (req, res) => {
    db.query(
      `SELECT
    review.id,
    JSON_OBJECT(
      'id', room.id,
      'building', room.building,
      'newAddress', room.newAddress,
      'oldAddress', room.oldAddress,
      'latitude', room.latitude,
      'longitude', room.longitude,
      'sido', room.sido,
      'sigungu', room.sigungu,
      'dong', room.dong
    ) AS room,
    review.userId,
    review.nickname,
    review.pros,
    review.cons,
    review.score
  FROM
    review
  INNER JOIN
    room ON review.roomId = room.id 
  ORDER BY
    review.id DESC`,
      (error, results) => {
        if (error) return res.status(400).send(error);
        //룸 객체 변환
        results.forEach((result) => {
          result.room = JSON.parse(result.room);
        });
        return res.status(200).json(results);
      }
    );
  });

  router.get(`/get/:id`, (req, res) => {
    const reviewId = req.params.id;
    db.query(
      `SELECT
    review.id,
    JSON_OBJECT(
      'id', room.id,
      'building', room.building,
      'newAddress', room.newAddress,
      'oldAddress', room.oldAddress,
      'latitude', room.latitude,
      'longitude', room.longitude,
      'sido', room.sido,
      'sigungu', room.sigungu,
      'dong', room.dong
    ) AS room,
    review.userId,
    review.nickname,
    review.pros,
    review.cons,
    review.score,
    review.imageUrl
  FROM
    review
  INNER JOIN
    room ON review.roomId = room.id
    WHERE review.id = ?`,
      [reviewId],
      (error, results) => {
        if (error) return res.status(400).send(error);
        results[0].room = JSON.parse(results[0].room);
        return res.status(200).send(results[0]);
      }
    );
  });

  router.delete(`/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const reviewId = req.params.id;
    let roomId;
    db.query(
      `SELECT * FROM review WHERE id = ? AND userId = ?`,
      [reviewId, user.id],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        roomId = results[0].roomId;
        if (results[0].imageUrl.length > 0)
          await deleteImageFromS3(
            "homereview1",
            results[0].imageUrl.split(".com/")[1]
          );
        db.query(
          `SELECT COUNT(*) AS count FROM review WHERE roomId = ?`,
          [roomId],
          (error, results) => {
            if (error) return res.status(400).send(error);

            if (results[0].count === 1)
              db.query(
                `DELETE FROM room WHERE id = ?`,
                [roomId],
                (error, results) => {
                  if (error) return res.status(400).send(error);
                }
              );

            db.query(
              `DELETE FROM review WHERE id = ?`,
              [reviewId],
              (error, results) => {
                if (error) return res.status(400).send(error);
                return res.status(200).send("OK");
              }
            );
          }
        );
      }
    );
  });

  router.get(`/room/sido/:sido`, (req, res) => {
    const sido = req.params.sido;
    db.query(`SELECT * FROM room WHERE sido = ?`, [sido], (error, results) => {
      if (error) return res.status(400).send(error);
      return res.status(200).send(results);
    });
  });

  router.get(`/search/:id`, (req, res) => {
    const roomId = req.params.id;

    db.query(
      `SELECT
    review.id,
    JSON_OBJECT(
      'id', room.id,
      'building', room.building,
      'newAddress', room.newAddress,
      'oldAddress', room.oldAddress,
      'latitude', room.latitude,
      'longitude', room.longitude,
      'sido', room.sido,
      'sigungu', room.sigungu,
      'dong', room.dong
    ) AS room,
    review.userId,
    review.nickname,
    review.pros,
    review.cons,
    review.score
  FROM
    review
  INNER JOIN
    room ON review.roomId = room.id
    WHERE room.id = ?
    ORDER BY
    review.id DESC`,
      [roomId],
      (error, results) => {
        if (error) return res.status(400).send(error);
        //룸 객체 변환
        results.forEach((result) => {
          result.room = JSON.parse(result.room);
        });
        return res.status(200).send(results);
      }
    );
  });

  router.get(`/mypage/all`, authenticateUser(db), (req, res) => {
    const user = req.user;
    db.query(
      `SELECT
    review.id,
    JSON_OBJECT(
      'id', room.id,
      'building', room.building,
      'newAddress', room.newAddress,
      'oldAddress', room.oldAddress,
      'latitude', room.latitude,
      'longitude', room.longitude,
      'sido', room.sido,
      'sigungu', room.sigungu,
      'dong', room.dong
    ) AS room,
    review.userId,
    review.nickname,
    review.pros,
    review.cons,
    review.score
  FROM
    review
  INNER JOIN
    room ON review.roomId = room.id 
    WHERE userId = ? 
  ORDER BY
    review.id DESC
    `,
      [user.id],
      (error, results) => {
        if (error) return res.status(400).send(error);
        //룸 객체 변환
        results.forEach((result) => {
          result.room = JSON.parse(result.room);
        });
        return res.status(200).json(results);
      }
    );
  });

  router.get("/getuploadurl", authenticateUser(db), async (req, res) => {
    const user = req.user;
    try {
      const bucket = "homereview1";
      const key = "review/" + user.nickname + "_" + new Date().getTime();

      const params = {
        Bucket: bucket,
        Key: key,
        Expires: 60 * 5, // URL is valid for 5 minutes
        ContentType: "image/jpeg",
      };

      const presignedUrl = await generatePresignedUrl(params);
      const imageUrl = `https://${bucket}.s3.${s3.config.region}.amazonaws.com/${key}`;

      return res
        .status(200)
        .send({ presignedUrl: presignedUrl, imageUrl: imageUrl });
    } catch (error) {
      console.error(error);
      return res.status(500).send({
        error: "An error occurred while generating the presigned URL.",
      });
    }
  });

  function generatePresignedUrl(params) {
    return new Promise((resolve, reject) => {
      s3.getSignedUrl("putObject", params, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    });
  }

  const deleteImageFromS3 = (bucket, key) => {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucket,
        Key: key,
      };

      s3.deleteObject(params, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  };
  module.exports = {
    deleteImageFromS3,
  };

  return router;
};
