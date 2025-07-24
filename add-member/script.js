const NAMELIST_URL = "https://script.google.com/macros/s/AKfycbyl9G4SpHidYTbpvW7tKoWbu7OQzSwo9P2y10-jjLZZvjk53YSjWuCsKLtaHfRge5J37A/exec";


// ボタン処理
async function execRegist() {
  // フォームのバリデーション
  if (!$('form')[0].reportValidity()) {
    $('html, body').animate({ scrollTop: 0 }, 'normal');
    return false;
  }

  $('body').css('cursor', 'wait');
  $('#overlay').show();

  console.log(`クラブ員追加処理開始：[${getJSTISOString()}]`);
  try {
    Swal.fire({
      title: '登録中です...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const requestData = {
      type: 'regist',
      name: $('#name').val(),
      namek: $('#namek').val(),
    };
    const response = await fetch(NAMELIST_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(requestData)
    });

    Swal.close();
    const result = await response.json();
    if (result.status === 'error') {
      // 何かしら失敗したら入る
      Swal.fire({
        icon: "error",
        title: "Oops...",
        html: result.message,
      });
      console.log(`クラブ員追加処理失敗：[${getJSTISOString()}]`);
      return;
    }

    console.log(`クラブ員追加処理完了：[${getJSTISOString()}]`);
    Swal.fire({
      title: "Good job!",
      text: "正常に登録されました。",
      icon: "success",
      showConfirmButton: false,
      timer: 2000
    });
  } catch (e) {
    console.error(`クラブ員登録処理失敗：[${getJSTISOString()}]：`, e);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      html: e.message,
    });
  } finally {
    $('body').css('cursor', 'default');
    $('#overlay').hide();
  }
}

//日本時間取得
function getJSTISOString() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // UTC+9時間をミリ秒で計算
  const jstDate = new Date(now.getTime() + jstOffset);
  return jstDate.toISOString().replace('T', ' ').slice(0, 23); // ミリ秒3桁まで
}