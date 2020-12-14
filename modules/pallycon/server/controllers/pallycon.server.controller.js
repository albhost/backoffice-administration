'use strict';


var path = require('path');
var makeDrm = require(path.resolve('./modules/pallycon/server/core/logics/makeDrmData'));
var issueCID = require(path.resolve('./modules/pallycon/server/core/logics/CIDIssue'));
var rightsInfo = require(path.resolve('./modules/pallycon/server/core/logics/ContentUsageRightsInfo'));
var responses = require(path.resolve("./config/responses.js"));

const makeDrmDynamic = require('../core/logics/makeDrmDataDynamic');
const xml2js = require("xml2js");
const xmlparser = new xml2js.Parser();
const winston = require(path.resolve('./config/lib/winston'));
const crypto = require("crypto");

exports.handleCIDIssue = function (req, res) {
  res.send(issueCID.makeRes(req.body.data));
};

exports.handleContentUsageRightInfo = function (req, res) {
  res.send(rightsInfo.makeRes(req.body.data));
};

/**
 * @api {post} apiv2/pallycon/TokenIssue Get pallycon token
 * @apiName GetPallyconToken
 * @apiGroup Pallycon
 * @apiVersion  0.2.0
 * @apiHeader {String} auth Authoriation token
 * @apiSuccess (200) {Object[]} data Response
 * @apiError {String} error.message Message description of error
 */
exports.contentUsageRightsInfoDynamic = async function (req, res) {
  /* ============================================================================== */
    /* =   PAGE : Content Usage Rights Info 생성 page                 = */
    /* = -------------------------------------------------------------------------- = */
    /* =   PallyCon Cloud 서버에서 License를 생성할 때, 필요한 콘텐츠 사용 권한 정보         = */
    /* =   를 생성하는 페이지입니다.                             = */
    /* =                                                                            = */
    /* =   ※ 중요                                                               = */
    /* =   Content Usage Rights Info를 생성하는 부분에 업체 정책에 반영됩니다.        = */
    /* =      상용시에는 반드시 입력해 주셔야 합니다.                       = */
    /* = -------------------------------------------------------------------------- = */
    /* =   PAGE : Content Usage Rights Info issuance page                           = */
    /* = -------------------------------------------------------------------------- = */
    /* =   This page generates content usage rights info which will be used by    = */
    /* =   PallyCon Cloud server for license issuance.                              = */
    /* =                                                                            = */
    /* =   ※ Note                                 = */
    /* =   Need to apply your logic to generate Content Usage Rights Info    = */
    /* =      for production service.                       = */
    /* = -------------------------------------------------------------------------- = */
    /* =   Copyright (c)  2015   INKA Entworks Inc.   All Rights Reserverd.         = */
    /* ============================================================================== */

    /* ============================================================================== */
    /* =   1. 데이터 설정                               = */
    /* = -------------------------------------------------------------------------- = */
    /* =   1-1. ERROR_CODE/MESSAGE 설정                        = */
    /* =   - ERROR_CODE: 4자리의 숫자로만 구성됩니다. INKA에서 이미 설정된 값을 사용         = */
    /* =                 합니다. 업체에서 사용되는 에러코드는 정책 반영하는 부분에           = */
    /* =                 설명되어 있으니 참고 부탁드립니다.                    = */
    /* =    ** 0000 은 성공입니다. 다른 값은 에러로 인식됩니다.                 = */
    /* = -------------------------------------------------------------------------- = */
    /* =   1-1. ERROR_CODE/MESSAGE setting                                         = */
    /* =   - ERROR_CODE: 4 digit value. Pre-defined by INKA.            = */
    /* =                 The error codes for your service can be set when setting   = */
    /* =                 your business rules.                   = */
    /* =    ** 0000 means success. Other codes mean failure.            = */
    /* = -------------------------------------------------------------------------- = */
    var ERROR_CODE = "0000";
    var MESSAGE = "";
    /* = -------------------------------------------------------------------------- = */
    /* =   1-2. Content Usage Rights Info, sNonce 설정               = */
    /* =   - sLIMIT, sPD_START, sPD_END, sPD_COUNT: Content Usage Rights Info 입니다 = */
    /* =                            업체에서 생성해야 할 값입니다. BM 적용 전에는         = */
    /* =                            CONFIG.php의 값을 사용합니다.             = */
    /* =   - sNonce: PallyCon Cloud Server에서 요청할 때 전달하는 값으로 페이지에서       = */
    /* =             응답데이터를 PallyCon Cloud Server로 전달하면, 그 값이 유효한지        = */
    /* =             판단합니다.                           = */
    /* = -------------------------------------------------------------------------- = */
    /* =   1-2. Content Usage Rights Info, sNonce settings                         = */
    /* =   - sLIMIT, sPD_START, sPD_END, sPD_COUNT: Content Usage Rights Info   = */
    /* =                  These values should be set by service provider.     = */
    /* =                  The default test values will be set by CONFIG.php         = */
    /* =   - sNonce: A value which will be used for authentication of response.   = */
    /* =             It will be passed in a request from PallyCon Cloud server    = */
    /* =             and checked by PallyCon Cloud server in a response data.   = */
    /* = -------------------------------------------------------------------------- = */
    var sLIMIT = "";
    var sPD_START = "";
    var sPD_END = "";
    var sPD_COUNT = "";
    var sNonce = "";
    /* = -------------------------------------------------------------------------- = */
    /* =   1-3. sResponse: PallyCon Cloud Server로 전달하는 응답값입니다.         = */
    /* = -------------------------------------------------------------------------- = */
    /* =   1-3. sResponse: response data to PallyCon Cloud Server          = */
    /* = -------------------------------------------------------------------------- = */
    var sResponse = "";
    /* = -------------------------------------------------------------------------- = */
    /* =   1. 데이터 설정 END / End of data setting                 = */
    /* ============================================================================== */


    /* ============================================================================== */
    /* =   2. REQUEST DATA 파싱 / Parsing request data               = */
    /* = -------------------------------------------------------------------------- = */
    /* =   2-1. REQUEST DATA에서 data의 값을 추출합니다.                 = */
    /* = -------------------------------------------------------------------------- = */
    /* =   2-1. Get data from REQUEST                        = */
    /* = -------------------------------------------------------------------------- = */
    var sData = "";
    if (req.body.data) {
      sData = req.body.data;
      //console.log("[Encrypted String]: " + sData);
    }
    /* = -------------------------------------------------------------------------- = */
    /* =   2-2. 추출에 실패할 경우 에러코드와 메시지를 설정합니다.                 = */
    /* = -------------------------------------------------------------------------- = */
    /* =   2-2. Set error code and message if failed to parse data                 = */
    /* = -------------------------------------------------------------------------- = */
    else {
      ERROR_CODE = "2201";
      MESSAGE = "NO DATA";
      //console.log("[ERROR]: " + ERROR_CODE + "\n[MESSAGE]: " + MESSAGE);
    }
    /* = -------------------------------------------------------------------------- = */
    /* =   2. REQUEST DATA 파싱 END / End of parsing request data          = */
    /* ============================================================================== */


    /* ============================================================================== */
    /* =   3. REQUEST DATA 복호화 / Decrypt request data                = */
    /* = -------------------------------------------------------------------------- = */
    /* = -------------------------------------------------------------------------- = */
    /* =   3-1. ERROR_CODE 값이 성공이면 복호화를 시작합니다.                 = */
    /* =   복호화에 실패할 경우 에러코드와 메시지를 설정합니다.                    = */
    /* = -------------------------------------------------------------------------- = */
    /* =   3-1. Starting decryption if ERROR_CODE is 'success'.                    = */
    /* =   Set error code and message if failed to decrypt.                         = */
    /* = -------------------------------------------------------------------------- = */
    var sDecrypted = "";
    if (ERROR_CODE == "0000") {
      sDecrypted = makeDrmDynamic.decrypt(sData);
      if (sDecrypted) {
        //console.log("[Decrypted String]: " + sDecrypted);
        let parsedData = JSON.parse(sDecrypted);
        const contentExist = await makeDrmDynamic.checkContent(parsedData.cid);
        if (!contentExist) {
          ERROR_CODE = "7012";
          MESSAGE = "Does not match with token’s CID.";
          winston.error("[ERROR]: " + ERROR_CODE + "\n[MESSAGE]: " + MESSAGE);
        }
      } else {
        ERROR_CODE = "2202";
        MESSAGE = "Fail to Decrypt the data";
        winston.error("[ERROR]: " + ERROR_CODE + "\n[MESSAGE]: " + MESSAGE);
      }
    }
    /* = -------------------------------------------------------------------------- = */
    /* =   3. REQUEST DATA 복호화 END / End of decrypting request data        = */
    /* ============================================================================== */


    /* ============================================================================== */
    /* =   4. XML 파싱 / XML Parsing                         = */
    /* = -------------------------------------------------------------------------- = */
    /* = -------------------------------------------------------------------------- = */
    /* =   4-1. ERROR_CODE 값이 성공이면 XML을 파싱합니다.                 = */
    /* =   XML 파싱에 실패할 경우 에러코드와 메시지를 설정합니다.                   = */
    /* = -------------------------------------------------------------------------- = */
    /* =   4-1. Starts XML parsing if ERROR_CODE is 'success'.           = */
    /* =   Set error code and message if failed to parse XML.                       = */
    /* = -------------------------------------------------------------------------- = */
    var sJsonResult;
    if (ERROR_CODE == "0000") {
      if (makeDrmDynamic.getAPIType() == "XML") {
        xmlparser.parseString(sDecrypted, function (err, result) {
          //console.log('XML Value] :' + result);
          if (err) {
            ERROR_CODE = "2203";
            MESSAGE = "Fail to Parse XML";
            //console.log("[ERROR]: " + ERROR_CODE + "[MESSAGE]: " + MESSAGE);
          } else {
            //console.log('[XML-JSON Result] ' + JSON.stringify(result));
            sJsonResult = result;
            sNonce = sJsonResult.RES.NONCE;
          }
        });
      } else {    // JSON type
        sJsonResult = JSON.parse(sDecrypted);
        sNonce = sJsonResult.nonce;
      }
    }
    /* = -------------------------------------------------------------------------- = */
    /* =   4. XML 파싱 END / End of XML parsing                    = */
    /* ============================================================================== */


    /* ============================================================================== */
    /* =   5. Content Usage Rightes Info 생성 / Content Usage Right Info generation  = */
    /* =                                                                            = */
    /* =   ※ 중요 :  업체의 정책을 반영하는 곳입니다.                     = */
    /* =   ※ Note : Need to apply your CID generation rule here                     = */
    /* =                                                                            = */
    /* = -------------------------------------------------------------------------- = */
    /* =   5-1. ERROR_CODE 값이 성공이면 Content Usage Rights Info 생성을 시작합니다     = */
    /* = -------------------------------------------------------------------------- = */
    /* =   5-1. Starts generating Content ID if ERROR_CODE is 'success'.           = */
    /* = -------------------------------------------------------------------------- = */
    if (ERROR_CODE == "0000") {

      /*-
       *
       * [업체 청책 반영]
       *
       * 업체의 정책에 맞게 Content Usage Rights Info를 생성하는 로직을 이곳에 구현합니다.
       * Content Usage Rights Info를 생성하는데 활용할 값은 다음과 같습니다.
       *
       * - sUserID
       * - sCID
       * - sPDID
       * - sDeviceModel
       * - sOID
       *
       * ** BM 적용 전에는 위 값들을 CONFIG.php에서 정의된 값들로 설정됩니다.
       *
       * ERROR_CODE는 성공일 경우 "0000"을 유지 시켜줍니다.
       *
       *
       * [Applying Content Usage Rights rule]
       *
       * Your Usage Rule generation logic can be applied here.
       * The below parameters can be used for the logic.
       *
       * - sUserID
       * - sCID
       * - sPDID
       * - sDeviceModel
       * - sOID
       *
       * ** The default test values are defined in CONFIG.php.
       *
       * ERROR_CODE "0000" means success.
       *
       */

      var sUserID, sCID, sDeviceID, sDeviceModel, sDeviceType, sOID, sDrmType;
      if (makeDrmDynamic.getAPIType() == "XML") {
        sUserID = sJsonResult.RES.USERID.toString(); // 클라이언트에서 추출한 사용자 아이디
        sCID = sJsonResult.RES.CID.toString(); // 클라이언트에서 추출한 콘텐츠의 Content ID
        sDeviceID = sJsonResult.RES.DEVICEID.toString(); // 클라이언트에서 추출한 기기 아이디
        sDeviceModel = sJsonResult.RES.DEVICEMODEL.toString(); // 클라이언트에서 추출한 기기 모델
        sOID = sJsonResult.RES.OID.toString(); // 클라이언트에서 추출한 콘텐츠 구매 정보 (Order ID)

      } else {    // JSON type
        sUserID = sJsonResult.user_id; // 클라이언트에서 추출한 사용자 아이디
        sCID = sJsonResult.cid; // 클라이언트에서 추출한 콘텐츠의 Content ID
        sDeviceID = sJsonResult.device_id; // 클라이언트에서 추출한 기기 아이디
        sDeviceType = sJsonResult.device_type; // 클라이언트 기기 유형
        sOID = sJsonResult.oid; // 클라이언트에서 추출한 콘텐츠 구매 정보 (Order ID)
        sDrmType = sJsonResult.drm_type;
      }

      // User ID 체크 로직 ('valid-user'로 하드코딩..)
      if (sUserID) {
        ERROR_CODE = "0000";
        // 테스트용 기본 라이선스 데이터 (Unlimited license)
        sLIMIT = "N";
        sPD_START = "";
        sPD_END = "";
        sPD_COUNT = 0;
      } else {
        ERROR_CODE = "4321";
        MESSAGE = "Not a valid user ID: " + sUserID;
        //console.log("[ERROR]: " + ERROR_CODE + "\n[MESSAGE]: " + MESSAGE);
      }
    }

    /* = -------------------------------------------------------------------------- = */
    /* =   5. Content Usage Rightes Info 생성 END / End of generation        = */
    /* ============================================================================== */

    if (makeDrmDynamic.getAPIType() == "XML") {
      /* ============================================================================== */
      /* =   6. 응답 데이타 생성 [XML] / Generating response data [XML]         = */
      /* = -------------------------------------------------------------------------- = */
      /* =   Content Usage Info 생성 성공 여부에 따른 XML 값을 생성하여 전달합니다.         = */
      /* = -------------------------------------------------------------------------- = */
      /* =   Creates and responds XML data with Content Usage Info generation result  = */
      /* = -------------------------------------------------------------------------- = */
      sResponse = "<?xml version='1.0' encoding='utf-8'?><RES>";
      sResponse += "<ERROR>" + ERROR_CODE + "</ERROR>";

      /* = -------------------------------------------------------------------------- = */
      /* =   6-1. ERROR_CODE 값이 성공이 아닐 경우 MESSAGE를 Content Usage Rights      = */
      /* =         Info대신 추가                              = */
      /* = -------------------------------------------------------------------------- = */
      /* =   6-1. Adds error message if ERROR_CODE is not 'success'          = */
      /* = -------------------------------------------------------------------------- = */
      if (ERROR_CODE != "0000") {
        sResponse += "<ERRMSG>" + MESSAGE + "</ERRMSG>";
      }
      /* = -------------------------------------------------------------------------- = */
      /* =   6-2. ERROR_CODE 값이 성공일 경우 Content Usage Rights Info 값을 추가       = */
      /* = -------------------------------------------------------------------------- = */
      /* =   6-2. Adds Content Usage Rights Info if ERROR_CODE is 'success'          = */
      /* = -------------------------------------------------------------------------- = */
      else {
        sResponse += "<LIMIT>" + sLIMIT + "</LIMIT>";
        sResponse += "<PD_COUNT>" + sPD_COUNT + "</PD_COUNT>";
        sResponse += "<PD_START>" + sPD_START + "</PD_START>";
        sResponse += "<PD_END>" + sPD_END + "</PD_END>";
      }
      sResponse += "<NONCE>" + sNonce + "</NONCE>";
      sResponse += "</RES>";
      //console.log("[Result XML]: " + sResponse);
      /* = -------------------------------------------------------------------------- = */
      /* =   6. 응답 데이타 생성 [XML] END / End of response data generation [XML]      = */
      /* ============================================================================== */
    } else {
      var jsonResponse = {
        "error_code": ERROR_CODE,
        "error_message": MESSAGE,
        "playback_policy": {
          "limit": false,
          "persistent": true,
          "duration": 172800,
          "expire_date": ""
        },
        "security_policy": {
          "allow_mobile_abnormal_device": true
        },
        "nonce": sNonce
      };
      sResponse = JSON.stringify(jsonResponse);
      //console.log("[Result JSON]: " + sResponse);
    }

    /* ============================================================================== */
    /* =   7. 응답 데이타 암호화 / Encryption of response data             = */
    /* = -------------------------------------------------------------------------- = */
    /* =   XML 값을 생성하여 반환합니다.                           = */
    /* = -------------------------------------------------------------------------- = */
    /* =   Encrypts XML data to respond                                             = */
    /* = -------------------------------------------------------------------------- = */
    var sEncrypted = makeDrmDynamic.encrypt(sResponse);
    //console.log("[Encrypted DATA]: " + sEncrypted);

    //return sEncrypted;
    res.send(sEncrypted)
    /* = -------------------------------------------------------------------------- = */
    /* =   7. 응답 데이타 암호화 END / End of response data encryption         = */
    /* ============================================================================== */
};



// https://pallycon.com/docs/en/multidrm/license/license-token-tutorial/
/**
 * @api {get} apiv2/pallycon/TokenIssue Get pallycon token
 * @apiName GetPallyconToken
 * @apiGroup Pallycon
 * @apiVersion  0.2.0
 * @apiHeader {String} auth Authoriation token
 * @apiSuccess (200) {Object[]} data Response
 * @apiError {String} error.message Message description of error
 */

exports.TokenIssue = function (req, res) {

  //Step 1 - Input setting values

    const AES_IV = "0123456789abcdef";
    const siteInfo = {
        siteId: "KMDK",
        siteKey: "",
        accessKey: ""
    };

  let licenseInfo = {
    drmType: "NCG",
    contentId: "",
    userId: req.thisuser.username,
  };

  let licenseRule = {
    playback_policy: {
      limit: true,
      persistent: false,
      duration: 3600
    },
    security_policy: {
      hardware_drm: false,
      output_protect: {
        allow_external_display: true,
        control_hdcp: 0
      },
      allow_mobile_abnormal_device: true,
      playready_security_level: 150
    }
  };

  //Step 2 - Encrypt license rule
  const cipher = crypto.createCipheriv("aes-256-cbc", siteInfo.siteKey, AES_IV);
  let encryptedRule = cipher.update(
    JSON.stringify(licenseRule),
    "utf-8",
    "base64"
  );
  encryptedRule += cipher.final("base64");

  //console.log("encrypted rule : " + encryptedRule);

  //Step 3 - Create hash value
  let util = {
    leadingZeros: (n, digits) => {
      let zero = "";
      n = n.toString();
      if (n.length < digits) {
        for (var i = 0; i < digits - n.length; i++) zero += "0";
      }
      return zero + n;
    },
    getUTCTime: inputTime => {
      let now;
      if (inputTime) {
        now = new Date(inputTime);
      } else {
        now = new Date();
      }
      let tz = now.getTime() + now.getTimezoneOffset() * 60000;

      now.setTime(tz);
      let s =
        util.leadingZeros(now.getFullYear(), 4) +
        "-" +
        util.leadingZeros(now.getMonth() + 1, 2) +
        "-" +
        util.leadingZeros(now.getDate(), 2) +
        "T" +
        util.leadingZeros(now.getHours(), 2) +
        ":" +
        util.leadingZeros(now.getMinutes(), 2) +
        ":" +
        util.leadingZeros(now.getSeconds(), 2) +
        "Z";
      return s;
    }
  };
  const currentTimeStamp = util.getUTCTime();
  let hashData = {
    siteId: siteInfo.siteId,
    accessKey: siteInfo.accessKey,
    drmType: licenseInfo.drmType,
    userId: licenseInfo.userId,
    cid: licenseInfo.contentId,
    token: encryptedRule,
    timestamp: currentTimeStamp
  };
  const hashInput =
    hashData.accessKey +
    hashData.drmType +
    hashData.siteId +
    hashData.userId +
    hashData.cid +
    hashData.token +
    hashData.timestamp;
  //console.log("hash input : " + hashInput);
  let hashString = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("base64");
  //console.log("hash string : " + hashString);
  //Step 4 - Create license token
  let tokenData = {
    drm_type: licenseInfo.drmType,
    site_id: siteInfo.siteId,
    user_id: licenseInfo.userId,
    cid: licenseInfo.contentId,
    token: encryptedRule,
    timestamp: currentTimeStamp,
    hash: hashString
  };

  //console.log("token json : " + JSON.stringify(tokenData));
  let thisbase64TokenObject = {};
  thisbase64TokenObject.base64Token = Buffer.from(JSON.stringify(tokenData)).toString("base64");
  let thisresponse = [];
  thisresponse.push(thisbase64TokenObject);

  //console.log("base64 encoded token : " + base64Token);
  //res.send(base64Token);
  responses.sendv3(req, res, thisresponse, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');

};


/**
 * @api {get} apiv2/pallycon/CustomDataIssue/:drmType Get pallycon token
 * @apiName GetPallyconToken
 * @apiGroup Pallycon
 * @apiVersion  0.2.0
 * @apiHeader {String} auth Authoriation token
 * @apiSuccess (200) {Object[]} data Response
 * @apiError {String} error.message Message description of error
 */

exports.CustomDataIssue = function (req, res) {
  const drmType = req.params.drmType || "widevine";

  const AES_IV = "0123456789abcdef";
  const siteInfo = {
    siteId: "KMDK",
    siteKey: "",
    accessKey: ""
  };

  const data = {
    user_id: req.thisuser.username,
    cid: "",
    oid: ""
  };


  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(siteInfo.siteKey), AES_IV);

  let customDataEncrypted = cipher.update(
    JSON.stringify(data),
    "utf-8",
    "base64"
  );

  customDataEncrypted += cipher.final("base64");

  const responseData = {
    drm_type: drmType,
    site_id: siteInfo.siteId,
    data: customDataEncrypted
  };

  const finalCustomData = Buffer.from(JSON.stringify(responseData)).toString('base64');

  responses.sendv3(req, res, [{ customDatav2: finalCustomData }], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
};
