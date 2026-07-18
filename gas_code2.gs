function doGet(e) {
  // 1番目のシートを指定
  //const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const sheet = SpreadsheetApp.openById("1UNj-asKljPO59GLzdkrd2H-H9IPflVyhMhxa9kCd1QY").getSheets()[0];


  // データ範囲を一括取得（A列とB列のみ）
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();

  // 空行を除外（A列＝名前が空でなければ有効とみなす）
  const filtered = data.filter(row => row[0] !== '' && row[0] !== null && row[0] !== undefined);

  return ContentService
    .createTextOutput(JSON.stringify(filtered))
    .setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  try {
    // リクエストデータを取得
    const requestData = JSON.parse(e.postData.contents);
    const type = requestData.type;
    const name = requestData.name;
    const namek = requestData.namek;

    // 処理タイプが "regist" の場合のみ処理
    if (type === 'regist') {
      //const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      const sheet = SpreadsheetApp.openById("1UNj-asKljPO59GLzdkrd2H-H9IPflVyhMhxa9kCd1QY").getSheets()[0];
      if (!sheet) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: 'error', message: '指定されたシートが存在しません。' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      // データを最終行に追加
      sheet.appendRow([name, namek]);

      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', message: '登録が完了しました。' })
      ).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: '不正な処理タイプです。' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}