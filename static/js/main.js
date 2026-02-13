/**
 * 폐기불량 관리시스템 - JavaScript (Flask 버전)
 */

// 전역 상태 관리
const state = {
  currentStep: 1,
  department: '',
  part: '',
  process: '',
  machine: '',
  person: '',
  isAdmin: false,
  adminPassword: '',
  currentNumpadTarget: ''
};

// 입력된 폐기 항목 목록
let scrapEntries = [];

// 폐기사유 목록 캐시
let scrapReasons = [];

// 현재 편집 중인 마스터 데이터 시트
let currentMasterSheet = '';

// 현재 표시 중인 테이블 데이터 (수정용)
let currentTableHeaders = [];
let currentTableRows = [];

// 드롭다운용 캐시 데이터
let cachedDepartments = [];
let cachedProcesses = [];

// 추가 모달용
let currentAddSheet = '';
let currentAddLabel = '';

// ==================== API 호출 함수 ====================

async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    return await response.json();
  } catch (error) {
    console.error('API 호출 오류:', error);
    showToast('서버 연결 오류', 'error');
    return null;
  }
}

// ==================== 화면 전환 ====================

function startInput() {
  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('inputScreen').classList.add('active');
  // Step 1은 Part 선택 (데이터 로드 불필요)
  updateProgress();
}

function goToStart() {
  resetState();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('startScreen').classList.add('active');
}

function resetState() {
  state.currentStep = 1;
  state.department = '';
  state.part = '';
  state.process = '';
  state.machine = '';
  state.person = '';
  scrapEntries = [];

  document.querySelectorAll('.step-container').forEach(c => c.classList.remove('active'));
  document.getElementById('step1').classList.add('active');
  updateProgress();
  updateEntriesTable();
}

// ==================== 진행 단계 ====================

function updateProgress() {
  document.querySelectorAll('.progress-step').forEach((step, idx) => {
    step.classList.remove('active', 'completed');
    const stepNum = idx + 1;
    if (stepNum < state.currentStep) {
      step.classList.add('completed');
    } else if (stepNum === state.currentStep) {
      step.classList.add('active');
    }
  });
}

function goToStep(step) {
  state.currentStep = step;
  document.querySelectorAll('.step-container').forEach(c => c.classList.remove('active'));
  document.getElementById('step' + step).classList.add('active');
  updateProgress();
}

function prevStep(current) {
  goToStep(current - 1);
}

// ==================== 데이터 로드 ====================

async function loadDepartments() {
  showLoading();
  const data = await apiCall('/api/departments');
  hideLoading();

  if (data) {
    const container = document.getElementById('departmentList');
    container.innerHTML = '';
    data.forEach(dept => {
      container.innerHTML += `<button class="btn btn-select" onclick="selectDepartment('${escapeHtml(dept)}')">${escapeHtml(dept)}</button>`;
    });
  }
}

async function loadProcesses() {
  showLoading();
  const data = await apiCall(`/api/processes?part=${encodeURIComponent(state.part)}`);
  hideLoading();

  if (data) {
    const container = document.getElementById('processList');
    container.innerHTML = '';
    data.forEach(proc => {
      container.innerHTML += `<button class="btn btn-select" onclick="selectProcess('${escapeHtml(proc)}')">${escapeHtml(proc)}</button>`;
    });
  }
}

async function loadMachines() {
  showLoading();
  const data = await apiCall(`/api/machines?part=${encodeURIComponent(state.part)}&process=${encodeURIComponent(state.process)}`);
  hideLoading();

  if (data) {
    const container = document.getElementById('machineList');
    container.innerHTML = '';
    data.forEach(machine => {
      container.innerHTML += `<button class="btn btn-select" onclick="selectMachine('${escapeHtml(machine)}')">${escapeHtml(machine)}</button>`;
    });
  }
}

async function loadPersons() {
  showLoading();
  const data = await apiCall(`/api/persons?part=${encodeURIComponent(state.part)}&process=${encodeURIComponent(state.process)}&department=${encodeURIComponent(state.department)}`);
  hideLoading();

  if (data) {
    const container = document.getElementById('personList');
    container.innerHTML = '';
    data.forEach(person => {
      container.innerHTML += `<button class="btn btn-select" onclick="selectPerson('${escapeHtml(person)}')">${escapeHtml(person)}</button>`;
    });
  }
}

// ==================== 선택 함수 ====================

function selectPart(part) {
  state.part = part;
  loadDepartments();
  goToStep(2);
}

function selectDepartment(dept) {
  state.department = dept;
  loadProcesses();
  goToStep(3);
}

function selectProcess(proc) {
  state.process = proc;
  loadMachines();
  goToStep(4);
}

function selectMachine(machine) {
  state.machine = machine;
  loadPersons();
  goToStep(5);
}

function skipMachine() {
  state.machine = '';
  loadPersons();
  goToStep(5);
}

function selectPerson(person) {
  state.person = person;
  goToStep(6);
  clearNewEntryForm();
}

// ==================== TM-NO 검색 ====================

async function searchNewTMNO() {
  const keyword = document.getElementById('newTmnoSearch').value.trim();
  const dropdown = document.getElementById('tmnoDropdown');

  if (keyword.length < 1) {
    dropdown.classList.remove('active');
    // TM-NO 검색창 비워지면 TM-NO 초기화 및 수량 비활성화
    document.getElementById('newTmno').value = '';
    document.getElementById('newProductName').value = '';
    document.getElementById('newUnitWeight').value = '';
    enableQuantityInput(false);
    return;
  }

  const data = await apiCall(`/api/tmnos?part=${encodeURIComponent(state.part)}&process=${encodeURIComponent(state.process)}`);

  if (data) {
    const filtered = data.filter(tmno =>
      String(tmno).toUpperCase().includes(keyword.toUpperCase())
    ).slice(0, 10);

    if (filtered.length > 0) {
      dropdown.innerHTML = '';
      filtered.forEach(tmno => {
        dropdown.innerHTML += `<div class="tmno-dropdown-item" onclick="selectNewTMNO('${escapeHtml(tmno)}')">${escapeHtml(tmno)}</div>`;
      });
      dropdown.classList.add('active');
    } else {
      dropdown.classList.remove('active');
    }
  }
}

async function selectNewTMNO(tmno) {
  document.getElementById('newTmnoSearch').value = tmno;
  document.getElementById('newTmno').value = tmno;
  document.getElementById('tmnoDropdown').classList.remove('active');

  // TM-NO 정보 가져오기
  const info = await apiCall(`/api/tmno_info?part=${encodeURIComponent(state.part)}&tmno=${encodeURIComponent(tmno)}`);

  if (info) {
    document.getElementById('newProductName').value = info.productName || '';
    document.getElementById('newUnitWeight').value = info.unitWeight || 0;
    // TM-NO 선택 시 수량 입력 활성화
    enableQuantityInput(true);
  }
}

// 수량 입력 활성화/비활성화
function enableQuantityInput(enabled) {
  const qtyInput = document.getElementById('newQuantity');
  if (enabled) {
    qtyInput.classList.remove('disabled-input');
    qtyInput.onclick = function() { showNumpad('newQuantity'); };
    qtyInput.style.cursor = 'pointer';
    qtyInput.style.opacity = '1';
  } else {
    qtyInput.classList.add('disabled-input');
    qtyInput.onclick = null;
    qtyInput.style.cursor = 'not-allowed';
    qtyInput.style.opacity = '0.5';
    qtyInput.value = '';
  }
}

// ==================== 폐기사유 선택 ====================

async function showReasonSelector() {
  showLoading();
  const data = await apiCall('/api/scrap_reasons');
  hideLoading();

  if (data) {
    scrapReasons = data;
    const container = document.getElementById('reasonList');
    container.innerHTML = '';
    data.forEach(reason => {
      container.innerHTML += `<button class="btn btn-select" onclick="selectReason('${escapeHtml(reason)}')">${escapeHtml(reason)}</button>`;
    });
    document.getElementById('reasonModal').classList.add('active');
  }
}

function selectReason(reason) {
  document.getElementById('newReason').value = reason;
  document.getElementById('newReasonBtn').textContent = reason;
  document.getElementById('newReasonBtn').classList.add('selected');
  closeModal('reasonModal');

  // 기타 사유인 경우 비고 입력창 표시
  const remarkContainer = document.getElementById('remarkContainer');
  if (reason === '기타_T/O품' || reason === '기타_불량품') {
    remarkContainer.style.display = 'block';
    document.getElementById('newRemark').value = '';
  } else {
    remarkContainer.style.display = 'none';
    document.getElementById('newRemark').value = '';
  }
}

// ==================== 숫자패드 ====================

function showNumpad(target) {
  state.currentNumpadTarget = target;
  const currentValue = document.getElementById(target).value || '';
  document.getElementById('numpadDisplay').value = currentValue;

  if (target === 'newQuantity') {
    document.getElementById('numpadTitle').textContent = '수량 입력';
  } else {
    document.getElementById('numpadTitle').textContent = '중량 입력 (kg)';
  }

  document.getElementById('numpadModal').classList.add('active');
}

function numpadInput(val) {
  const display = document.getElementById('numpadDisplay');
  display.value += val;
}

function numpadDelete() {
  const display = document.getElementById('numpadDisplay');
  display.value = display.value.slice(0, -1);
}

function numpadClear() {
  document.getElementById('numpadDisplay').value = '';
}

function numpadConfirm() {
  const value = document.getElementById('numpadDisplay').value;
  const target = state.currentNumpadTarget;

  document.getElementById(target).value = value;

  // 수량/중량 자동 계산
  const unitWeight = parseFloat(document.getElementById('newUnitWeight').value) || 0;

  if (target === 'newQuantity' && unitWeight > 0) {
    const qty = parseFloat(value) || 0;
    document.getElementById('newWeight').value = (qty * unitWeight).toFixed(3);
  } else if (target === 'newWeight' && unitWeight > 0) {
    const weight = parseFloat(value) || 0;
    document.getElementById('newQuantity').value = Math.round(weight / unitWeight);
  }

  closeModal('numpadModal');
}

// ==================== 항목 테이블 ====================

function addEntryToTable() {
  const tmno = document.getElementById('newTmno').value;
  const productName = document.getElementById('newProductName').value;
  const reason = document.getElementById('newReason').value;
  const quantity = document.getElementById('newQuantity').value;
  const weight = document.getElementById('newWeight').value;
  const unitWeight = document.getElementById('newUnitWeight').value;
  const remark = document.getElementById('newRemark').value.trim();

  // 폐기사유 필수
  if (!reason) {
    showToast('폐기사유를 선택해주세요.', 'error');
    return;
  }
  // 기타 사유인 경우 비고 필수
  if ((reason === '기타_T/O품' || reason === '기타_불량품') && !remark) {
    showToast('기타 사유를 입력해주세요.', 'error');
    return;
  }
  // TM-NO 없으면 중량 필수, 있으면 수량 또는 중량
  if (!tmno) {
    if (!weight) {
      showToast('중량을 입력해주세요.', 'error');
      return;
    }
  } else {
    if (!quantity && !weight) {
      showToast('수량 또는 중량을 입력해주세요.', 'error');
      return;
    }
  }

  scrapEntries.push({
    tmno: tmno || '-',
    productName: productName || '-',
    reason: reason,
    quantity: parseFloat(quantity) || 0,
    weight: parseFloat(weight) || 0,
    unitWeight: parseFloat(unitWeight) || 0,
    remark: remark
  });

  updateEntriesTable();
  clearNewEntryForm();
  showToast('항목이 추가되었습니다.', 'success');
}

function updateEntriesTable() {
  const tbody = document.getElementById('entryTableBody');
  tbody.innerHTML = '';

  scrapEntries.forEach((entry, idx) => {
    const remarkDisplay = entry.remark ? escapeHtml(entry.remark) : '-';
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(entry.reason)}</td>
        <td>${remarkDisplay}</td>
        <td>${escapeHtml(entry.tmno)}</td>
        <td>${escapeHtml(entry.productName)}</td>
        <td>${entry.quantity}</td>
        <td>${entry.weight}</td>
        <td><button class="btn-row-delete" onclick="deleteEntry(${idx})">삭제</button></td>
      </tr>
    `;
  });

  document.getElementById('entriesCount').textContent = scrapEntries.length;
}

function deleteEntry(idx) {
  scrapEntries.splice(idx, 1);
  updateEntriesTable();
}

function clearNewEntryForm() {
  document.getElementById('newTmnoSearch').value = '';
  document.getElementById('newTmno').value = '';
  document.getElementById('newProductName').value = '';
  document.getElementById('newReason').value = '';
  document.getElementById('newRemark').value = '';
  document.getElementById('remarkContainer').style.display = 'none';
  document.getElementById('newReasonBtn').textContent = '선택';
  document.getElementById('newReasonBtn').classList.remove('selected');
  document.getElementById('newQuantity').value = '';
  document.getElementById('newWeight').value = '';
  document.getElementById('newUnitWeight').value = '';
  // TM-NO 없으면 수량 비활성화
  enableQuantityInput(false);
}

// ==================== 저장 ====================

async function saveAllData() {
  if (scrapEntries.length === 0) {
    showToast('저장할 항목이 없습니다.', 'error');
    return;
  }

  showLoading();
  let successCount = 0;

  for (const entry of scrapEntries) {
    const result = await apiCall('/api/save_scrap', {
      method: 'POST',
      body: JSON.stringify({
        department: state.department,
        part: state.part,
        process: state.process,
        machine: state.machine,
        person: state.person,
        tmno: entry.tmno,
        productName: entry.productName,
        scrapReason: entry.reason,
        quantity: entry.quantity,
        weight: entry.weight,
        remark: entry.remark || ''
      })
    });

    if (result && result.success) {
      successCount++;
    }
  }

  hideLoading();

  if (successCount === scrapEntries.length) {
    showToast(`${successCount}건 저장 완료!`, 'success');
    scrapEntries = [];
    updateEntriesTable();
  } else {
    showToast(`${successCount}/${scrapEntries.length}건 저장됨`, 'error');
  }
}

// ==================== 모달 ====================

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ==================== 추가 모달 ====================

async function showAddModal(sheetName, label) {
  currentAddSheet = sheetName;
  currentAddLabel = label;

  document.getElementById('addModalTitle').textContent = label + ' 추가';
  const fieldsContainer = document.getElementById('addModalFields');
  fieldsContainer.innerHTML = '<p style="color:#aaa;">로딩 중...</p>';

  document.getElementById('addModal').classList.add('active');

  if (sheetName === 'Depart' || sheetName === 'scrap_name') {
    buildAddForm(sheetName, [], []);
  } else if (sheetName === 'Process') {
    // Process: Part 선택만 필요 (드롭다운은 하드코딩)
    buildAddForm(sheetName, [], []);
  } else if (sheetName === 'machine') {
    cachedProcesses = await apiCall('/api/process_list') || [];
    buildAddForm(sheetName, [], cachedProcesses);
  } else if (sheetName === 'person') {
    // person: Part, 공정, 부서 드롭다운 필요
    cachedDepartments = await apiCall('/api/simple_list/Depart') || [];
    cachedProcesses = await apiCall('/api/process_list') || [];
    buildAddForm(sheetName, cachedDepartments, cachedProcesses);
  } else if (sheetName.includes('TMNO')) {
    buildAddForm(sheetName, [], []);
  }
}

function buildAddForm(sheetName, departments, processes) {
  const fieldsContainer = document.getElementById('addModalFields');

  if (sheetName === 'Depart') {
    fieldsContainer.innerHTML = '<input type="text" class="modal-input" id="addField1" placeholder="부서명">';
  } else if (sheetName === 'Process') {
    // Process: Part + 공정
    fieldsContainer.innerHTML = `
      <select class="modal-input" id="addField1">
        <option value="">Part 선택</option>
        <option value="1Part">1Part</option>
        <option value="2Part">2Part</option>
      </select>
      <input type="text" class="modal-input" id="addField2" placeholder="공정명">
    `;
  } else if (sheetName === 'machine') {
    let processOptions = '<option value="">공정 선택</option>';
    processes.forEach(p => {
      processOptions += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
    });
    fieldsContainer.innerHTML = `
      <select class="modal-input" id="addField1">
        <option value="">Part 선택</option>
        <option value="1Part">1Part</option>
        <option value="2Part">2Part</option>
      </select>
      <select class="modal-input" id="addField2">${processOptions}</select>
      <input type="text" class="modal-input" id="addField3" placeholder="설비명">
    `;
  } else if (sheetName === 'person') {
    // person: Part + 공정 + 부서 + 폐기자
    let deptOptions = '<option value="">부서 선택</option>';
    departments.forEach(d => {
      deptOptions += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
    });
    let processOptions = '<option value="">공정 선택</option>';
    processes.forEach(p => {
      processOptions += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
    });
    fieldsContainer.innerHTML = `
      <select class="modal-input" id="addField1">
        <option value="">Part 선택</option>
        <option value="1Part">1Part</option>
        <option value="2Part">2Part</option>
      </select>
      <select class="modal-input" id="addField2">${processOptions}</select>
      <select class="modal-input" id="addField3">${deptOptions}</select>
      <input type="text" class="modal-input" id="addField4" placeholder="폐기자명">
    `;
  } else if (sheetName.includes('TMNO')) {
    fieldsContainer.innerHTML = `
      <input type="text" class="modal-input" id="addField1" placeholder="TM-NO">
      <input type="text" class="modal-input" id="addField2" placeholder="품명">
      <input type="number" step="0.001" class="modal-input" id="addField3" placeholder="단위중량">
    `;
  } else if (sheetName === 'scrap_name') {
    fieldsContainer.innerHTML = '<input type="text" class="modal-input" id="addField1" placeholder="폐기사유">';
  }
}

async function addData() {
  let data = [];

  if (currentAddSheet === 'Depart' || currentAddSheet === 'scrap_name') {
    const val1 = document.getElementById('addField1').value.trim();
    if (!val1) {
      showToast('값을 입력해주세요.', 'error');
      return;
    }
    data = [val1];
  } else if (currentAddSheet === 'Process') {
    const val1 = document.getElementById('addField1').value;
    const val2 = document.getElementById('addField2').value.trim();
    if (!val1 || !val2) {
      showToast('모든 값을 입력해주세요.', 'error');
      return;
    }
    data = [val1, val2];
  } else if (currentAddSheet === 'machine') {
    const val1 = document.getElementById('addField1').value;
    const val2 = document.getElementById('addField2').value;
    const val3 = document.getElementById('addField3').value.trim();
    if (!val1 || !val2 || !val3) {
      showToast('모든 값을 입력해주세요.', 'error');
      return;
    }
    data = [val1, val2, val3];
  } else if (currentAddSheet === 'person') {
    // person: Part, 공정, 부서, 폐기자명
    const val1 = document.getElementById('addField1').value;
    const val2 = document.getElementById('addField2').value;
    const val3 = document.getElementById('addField3').value;
    const val4 = document.getElementById('addField4').value.trim();
    if (!val1 || !val2 || !val3 || !val4) {
      showToast('모든 값을 입력해주세요.', 'error');
      return;
    }
    data = [val1, val2, val3, val4];
  } else if (currentAddSheet.includes('TMNO')) {
    const val1 = document.getElementById('addField1').value.trim();
    const val2 = document.getElementById('addField2').value.trim();
    const val3 = document.getElementById('addField3').value;
    if (!val1 || !val2) {
      showToast('TM-NO와 품명을 입력해주세요.', 'error');
      return;
    }
    data = [val1, val2, parseFloat(val3) || 0];
  }

  showLoading();
  const result = await apiCall(`/api/master_data/${currentAddSheet}`, {
    method: 'POST',
    body: JSON.stringify({ data: data })
  });
  hideLoading();

  closeModal('addModal');
  if (result && result.success) {
    showToast(result.message, 'success');
    refreshCurrentStepData();
  } else {
    showToast(result?.message || '추가 실패', 'error');
  }
}

function refreshCurrentStepData() {
  switch(state.currentStep) {
    case 2: loadDepartments(); break;
    case 3: loadProcesses(); break;
    case 4: loadMachines(); break;
    case 5: loadPersons(); break;
  }
}

// ==================== 관리자 모드 ====================

function showAdminLogin() {
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminLoginModal').classList.add('active');
}

async function adminLogin() {
  const password = document.getElementById('adminPassword').value;

  showLoading();
  const isValid = await apiCall('/api/verify_password', {
    method: 'POST',
    body: JSON.stringify({ password: password })
  });
  hideLoading();

  if (isValid) {
    state.isAdmin = true;
    state.adminPassword = password;
    closeModal('adminLoginModal');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('adminScreen').classList.add('active');
  } else {
    showToast('비밀번호가 올바르지 않습니다.', 'error');
  }
}

async function showMasterDataManager(sheetName, btn) {
  currentMasterSheet = sheetName;

  document.querySelectorAll('.btn-admin').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  showLoading();
  const result = await apiCall(`/api/master_data/${sheetName}`);
  hideLoading();

  if (result && result.success) {
    displayMasterDataTable(result.headers, result.rows);
  } else {
    document.getElementById('adminContent').innerHTML = '<p>데이터를 불러올 수 없습니다.</p>';
  }
}

function displayMasterDataTable(headers, rows) {
  currentTableHeaders = headers;
  currentTableRows = rows;

  let html = '<table class="data-table"><thead><tr>';

  headers.forEach(header => {
    html += '<th>' + escapeHtml(header) + '</th>';
  });
  html += '<th>관리</th></tr></thead><tbody>';

  rows.forEach((row, idx) => {
    html += '<tr>';
    row.data.forEach(cell => {
      html += '<td>' + (cell ? escapeHtml(String(cell)) : '-') + '</td>';
    });
    html += '<td>';
    html += `<button class="btn btn-edit" onclick="editMasterData(${idx}, ${row.rowIndex})">수정</button>`;
    html += `<button class="btn btn-delete" onclick="deleteMasterData(${row.rowIndex})">삭제</button>`;
    html += '</td></tr>';
  });

  html += '</tbody></table>';

  document.getElementById('adminContent').innerHTML = html;
}

function editMasterData(dataIndex, rowIndex) {
  const row = currentTableRows[dataIndex];
  const headers = currentTableHeaders;

  if (!row) {
    showToast('데이터를 찾을 수 없습니다.', 'error');
    return;
  }

  let fieldsHtml = '';
  headers.forEach((header, index) => {
    const value = row.data[index] || '';
    fieldsHtml += '<div style="margin-bottom:15px;">';
    fieldsHtml += `<label style="display:block; margin-bottom:5px; color:#aaa; font-size:14px;">${escapeHtml(header)}</label>`;
    fieldsHtml += `<input type="text" class="modal-input edit-field" data-index="${index}" value="${escapeHtml(String(value))}">`;
    fieldsHtml += '</div>';
  });

  document.getElementById('editModalFields').innerHTML = fieldsHtml;
  document.getElementById('editRowIndex').value = rowIndex;
  document.getElementById('editModal').classList.add('active');
}

async function saveEditData() {
  const rowIndex = parseInt(document.getElementById('editRowIndex').value);
  const fields = document.querySelectorAll('#editModalFields .edit-field');
  const newData = [];

  fields.forEach(field => {
    newData.push(field.value);
  });

  showLoading();
  const result = await apiCall(`/api/master_data/${currentMasterSheet}/${rowIndex}`, {
    method: 'PUT',
    body: JSON.stringify({
      data: newData,
      password: state.adminPassword
    })
  });
  hideLoading();

  if (result && result.success) {
    showToast(result.message, 'success');
    closeModal('editModal');
    showMasterDataManager(currentMasterSheet);
  } else {
    showToast(result?.message || '수정 실패', 'error');
  }
}

async function deleteMasterData(rowIndex) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  showLoading();
  const result = await apiCall(`/api/master_data/${currentMasterSheet}/${rowIndex}`, {
    method: 'DELETE',
    body: JSON.stringify({ password: state.adminPassword })
  });
  hideLoading();

  if (result && result.success) {
    showToast(result.message, 'success');
    showMasterDataManager(currentMasterSheet);
  } else {
    showToast(result?.message || '삭제 실패', 'error');
  }
}

async function showScrapRecords(btn) {
  currentMasterSheet = 'Data';

  document.querySelectorAll('.btn-admin').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  showLoading();
  const result = await apiCall('/api/scrap_records');
  hideLoading();

  if (result && result.success) {
    displayMasterDataTable(result.headers, result.rows);
  } else {
    document.getElementById('adminContent').innerHTML = '<p>데이터를 불러올 수 없습니다.</p>';
  }
}

// ==================== 유틸리티 ====================

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showLoading() {
  document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast active ' + type;

  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// ==================== 초기화 ====================

document.addEventListener('DOMContentLoaded', function() {
  console.log('폐기불량 관리시스템 초기화 완료');
});
