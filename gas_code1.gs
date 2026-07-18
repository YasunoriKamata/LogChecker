// 出勤簿登録用スクリプト
// 定数定義
const SHEET_NAMES = {
  HEADER: 'ヘッダー',
  DETAIL: '明細'
};

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);

  try {
    switch (data.type) {
      case 'regist':
        return registData(ss, data);
      case 'delete':
        return deleteData(ss, data);
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}
// データ登録処理
function registData(ss, data) {
  // トランザクション処理のため、エラーが発生した場合は保存を行わない
  try {
    // 既存データの存在チェック
    const headerSheet = ss.getSheetByName(SHEET_NAMES.HEADER);
    const headerLastRow = headerSheet.getLastRow();
    if (headerLastRow > 1) {
      const headerValues = headerSheet.getRange(2, 1, headerLastRow - 1, 2).getValues();
      const isDuplicate = headerValues.some(([date, location]) =>
        formatDate(new Date(date)) === data.date && String(location) === data.location
      );
      if (isDuplicate) {
        return createErrorResponse('既に登録済みのデータがあります。<br>一度削除してから再度登録してください。');
      }
    }

    // ヘッダーデータの保存
    // const headerRow = [
    //   data.date,       // 日付
    //   data.location,   // 監視所
    //   data.recorder,   // 記入者
    //   data.supervisor, // 監視長
    //   new Date()       // timestamp
    // ];
    // headerSheet.appendRow(headerRow);

    // 明細データの保存
    const detailSheet = ss.getSheetByName(SHEET_NAMES.DETAIL);
    ensureConfirmationColumn(detailSheet);
    const details = data.details.map(detail => [
      data.date,         // 日付
      data.location,     // 監視所
      data.recorder,     // 記入者
      data.supervisor,   // 監視長
      detail.name,       // 名前
      detail.volunteer ? '1' : '0',  // ボランティア
      detail.shiftType,  // 勤務形態
      detail.startTime,  // 出勤時刻
      detail.endTime,    // 退勤時刻
      calculateWorkhours(detail.shiftType, detail.startTime, detail.endTime), // 実働時間
      detail.batchTest ? '1' : '0', // バッチテスト
      detail.remarks,    // 備考
      new Date(),        // timestamp
      data.managerConfirmed ? '1' : '0' // 統括確認済
    ]);

    detailSheet.getRange(
      detailSheet.getLastRow() + 1,
      1,
      details.length,
      details[0].length
    ).setValues(details);

    return createSuccessResponse('データが正常に保存されました');
  } catch (error) {
    throw new Error('データの保存中にエラーが発生しました: ' + error.message);
  }
}

// 時間勤のみ実働時間を時間単位の少数（例: 1.25）で計算する。日跨ぎ勤務は対象外。
function calculateWorkhours(shiftType, startTime, endTime) {
  if (String(shiftType) !== '2') {
    return null;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    throw new Error('時間勤の出勤時刻・退勤時刻は HH:mm 形式で入力してください。');
  }

  let workMinutes = endMinutes - startMinutes;
  if (workMinutes < 0) {
    throw new Error('退勤時刻は出勤時刻以降の時刻を入力してください。');
  }
  if (workMinutes >= 6 * 60) {
    workMinutes -= 60;
  }

  // 時刻は15分刻みのため、0.25時間単位の少数値になる。
  // 数値として保存するため、表示形式はスプレッドシート側に委ねる。
  return Number((workMinutes / 60).toFixed(2));
}

function parseTimeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// 明細シートのN列を「統括確認済」フラグとして使用する
function ensureConfirmationColumn(detailSheet) {
  const confirmationHeader = detailSheet.getRange(1, 14);
  if (!confirmationHeader.getValue()) {
    confirmationHeader.setValue('統括確認済');
  }
}

function createSuccessResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': message
  })).setMimeType(ContentService.MimeType.JSON);
}
function createErrorResponse(error) {
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'error',
    'message': error.toString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// データ削除処理
function deleteData(ss, data) {
  var detailSheet = ss.getSheetByName(SHEET_NAMES.DETAIL);
  var targetDate = data.date;
  var targetLocation = data.location;

  try {
    if (!detailSheet) {
      return createErrorResponse('明細シートが見つかりません。');
    }

    var lastRow = detailSheet.getLastRow();
    if (lastRow < 2) {
      return createErrorResponse('削除対象のデータがありません。');
    }

    // 削除対象データの存在チェック
    const values = detailSheet.getRange(2, 1, lastRow - 1, 14).getValues();
    const isExisting = values.some(([date, location]) =>
      formatDate(new Date(date)) === targetDate && String(location) === targetLocation
    );
    if (!isExisting) {
      return createErrorResponse('削除対象のデータがありません。');
    }

    const isManagerConfirmed = values.some(row =>
      formatDate(new Date(row[0])) === targetDate &&
      String(row[1]) === targetLocation &&
      (row[13] === 1 || row[13] === '1' || row[13] === true)
    );
    if (isManagerConfirmed) {
      return createErrorResponse('統括確認済みのデータは修正できません。');
    }


    for (var row = lastRow; row >= 2; row--) {
      var cellDate = formatDate(new Date(values[row - 2][0]));
      var cellLocation = String(values[row - 2][1]);

      if (cellDate === targetDate && cellLocation === targetLocation) {
        detailSheet.deleteRow(row);
      }
    }

    return createSuccessResponse('データが正常に削除されました');
  } catch (error) {
    throw new Error('データの削除中にエラーが発生しました: ' + error.message);
  }
}

// 管理者用スクリプト
const LOCATIONS = {
  MORITO: { id: '1', key: 'morito' },
  ISSHIKI: { id: '2', key: 'isshiki' },
  CHOJAGASAKI: { id: '3', key: 'chojagasaki' },
  EVENT: { id: '4', key: 'event' }
};

// メイン処理
function doGet(e) {
  const output = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const locationResults = {};
    const headerData = getHeaderData(ss);
    const detailData = getDetailData(ss);

    processHeaderData(headerData, locationResults);
    processDetailData(detailData, locationResults);

    output.setContent(JSON.stringify({
      status: 'success',
      ...locationResults
    }));

  } catch (error) {
    output.setContent(JSON.stringify({
      status: 'error',
      message: error.toString()
    }));
  }

  return output;
}

// ヘッダーデータの取得（全件）
function getHeaderData(ss) {
  const headerSheet = ss.getSheetByName(SHEET_NAMES.HEADER);
  const headerLastRow = headerSheet.getLastRow();
  if (headerLastRow < 2) return []; // データがない場合

  return headerSheet.getRange(2, 1, headerLastRow - 1, 4).getValues();
}

// 明細データの取得（全件）
function getDetailData(ss) {
  const detailSheet = ss.getSheetByName(SHEET_NAMES.DETAIL);
  const detailLastRow = detailSheet.getLastRow();
  if (detailLastRow < 2) return [];

  return detailSheet.getRange(2, 1, detailLastRow - 1, 14).getValues();
}

// ヘッダーデータの処理
function processHeaderData(headerData, results) {
  headerData.forEach(row => {
    const date = formatDate(new Date(row[0]));
    const locationId = row[1].toString();
    const writer = row[2];
    const supervisor = row[3];

    const location = Object.values(LOCATIONS).find(loc => loc.id === locationId);
    if (!location) return;

    if (!results[date]) results[date] = {};
    if (!results[date][location.key]) {
      results[date][location.key] = { writer: '', supervisor: '', managerConfirmed: false, details: [] };
    }

    results[date][location.key].writer = writer;
    results[date][location.key].supervisor = supervisor;
  });
}

// 明細データの処理
function processDetailData(detailData, results) {
  detailData.forEach(row => {
    const date = formatDate(new Date(row[0]));
    const locationId = row[1].toString();
    const detailInfo = {
      name: row[4],
      volunteer: row[5],
      type: row[6],
      startTime: formatTime(row[7]),
      endTime: formatTime(row[8]),
      batchTest: row[10],
      remarks: row[11]
    };

    const location = Object.values(LOCATIONS).find(loc => loc.id === locationId);
    if (!location) return;

    if (!results[date]) results[date] = {};
    if (!results[date][location.key]) {
      results[date][location.key] = { writer: '', supervisor: '', managerConfirmed: false, details: [] };
    }

    results[date][location.key].managerConfirmed = results[date][location.key].managerConfirmed ||
      row[13] === 1 || row[13] === '1' || row[13] === true;
    results[date][location.key].details.push(detailInfo);
  });
}

// 日付フォーマット（yyyy/MM/dd）
function formatDate(date) {
  return Utilities.formatDate(date, 'JST', 'yyyy/MM/dd');
}

// 時刻フォーマット（HH:mm）
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
