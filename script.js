// Инициализация Telegram
const tg = Telegram.WebApp;
tg.expand();
tg.ready();

// Состояние приложения
let currentUser = null;
let isAdmin = false;
let currentSection = 'stages';
let selectedSectionId = null;

// Получаем информацию о пользователе
const user = tg.initDataUnsafe?.user;
console.log('Данные пользователя:', user);

if (user) {
    currentUser = user;
    isAdmin = user.username === 'morion_1';
    
    document.getElementById('userName').textContent = `${user.first_name} ${user.last_name || ''}`.trim();
    document.getElementById('userUsername').textContent = user.username ? `@${user.username}` : 'нет username';
    
    const initials = (user.first_name.charAt(0) + (user.last_name?.charAt(0) || '')).toUpperCase();
    document.getElementById('userAvatar').textContent = initials || '👤';
    
    const badge = document.getElementById('userBadge');
    if (isAdmin) {
        badge.textContent = '👑 Админ';
        badge.className = 'user-badge badge-admin';
        document.getElementById('addBtn').style.display = 'flex';
        console.log('✅ Админ распознан, кнопка показана');
    } else {
        badge.textContent = '👁️ Пользователь';
        badge.className = 'user-badge badge-user';
        document.getElementById('addBtn').style.display = 'none';
        console.log('👁️ Обычный пользователь, кнопка скрыта');
    }
} else {
    console.log('❌ Нет данных пользователя (тестовый режим)');
    document.getElementById('userName').textContent = 'Тестовый режим';
    document.getElementById('userUsername').textContent = 'не в Telegram';
    document.getElementById('userAvatar').textContent = '👤';
    document.getElementById('userBadge').textContent = '🧪 Тест';
    document.getElementById('addBtn').style.display = 'flex';
}

// Принудительное отображение для админа
if (user && user.username === 'morion_1') {
    setTimeout(() => {
        document.getElementById('addBtn').style.display = 'flex';
        console.log('🔄 Принудительное отображение кнопки');
    }, 500);
}

// Навигация
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        btn.classList.add('active');
        const section = btn.dataset.section;
        currentSection = section;
        document.getElementById(`${section}-section`).classList.add('active');
        
        loadSection(section);
    });
});

// Кнопка добавления
document.getElementById('addBtn').addEventListener('click', () => {
    if (currentSection === 'stages') {
        openModal('addStageModal');
    } else if (currentSection === 'ready') {
        loadStagesForSelect();
        openModal('addReadyModal');
    } else if (currentSection === 'employees') {
        openModal('addEmployeeModal');
    }
});

// Закрытие модальных окон
document.getElementById('cancelStageBtn').addEventListener('click', () => closeModal('addStageModal'));
document.getElementById('cancelReadyBtn').addEventListener('click', () => closeModal('addReadyModal'));
document.getElementById('cancelEmployeeBtn').addEventListener('click', () => closeModal('addEmployeeModal'));
document.getElementById('cancelAcceptBtn').addEventListener('click', () => closeModal('acceptModal'));
document.getElementById('cancelRejectBtn').addEventListener('click', () => closeModal('rejectModal'));

// Кнопки действий
document.getElementById('createStageBtn').addEventListener('click', addStage);
document.getElementById('createReadyBtn').addEventListener('click', addReady);
document.getElementById('createEmployeeBtn').addEventListener('click', addEmployee);
document.getElementById('acceptBtn').addEventListener('click', acceptSection);
document.getElementById('rejectBtn').addEventListener('click', rejectSection);

// Загрузка секции
function loadSection(section) {
    if (section === 'stages') loadStages();
    else if (section === 'ready') loadReady();
    else if (section === 'accepted') loadAccepted();
    else if (section === 'stats') loadStats();
    else if (section === 'employees') loadEmployees();
}

// Отправка команды в бота
function sendAction(action, data = {}) {
    return new Promise((resolve) => {
        const messageId = Date.now();
        
        function handler(event) {
            if (event.data) {
                try {
                    const response = JSON.parse(event.data);
                    if (response.action === action || response.action === 'error') {
                        window.removeEventListener('message', handler);
                        resolve(response);
                    }
                } catch (e) {}
            }
        }
        
        window.addEventListener('message', handler);
        tg.sendData(JSON.stringify({
            action: action,
            data: data,
            messageId: messageId
        }));
        
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ success: false, error: 'timeout' });
        }, 10000);
    });
}

// Загрузка этапов
async function loadStages() {
    const list = document.getElementById('stagesList');
    list.innerHTML = '<div class="loading">Загрузка этапов...</div>';
    
    const response = await sendAction('get_stages');
    
    if (response.data && response.data.length > 0) {
        list.innerHTML = '';
        response.data.forEach(stage => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${stage.emoji} ${stage.name}</span>
                    <span class="item-badge">${stage.status}</span>
                </div>
                <div class="item-details">
                    <p>📏 ПК${stage.start} - ПК${stage.end}</p>
                    <p>📊 Слоев: ${stage.layers}</p>
                    <p>📅 ${stage.date}</p>
                </div>
            `;
            list.appendChild(card);
        });
    } else {
        list.innerHTML = '<div class="item-card">📭 Нет этапов</div>';
    }
}

// Загрузка готовых участков
async function loadReady() {
    const list = document.getElementById('readyList');
    list.innerHTML = '<div class="loading">Загрузка готовых участков...</div>';
    
    const response = await sendAction('get_ready');
    
    if (response.data && response.data.length > 0) {
        list.innerHTML = '';
        response.data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            let actions = '';
            if (isAdmin) {
                actions = `
                    <div class="item-actions">
                        <button class="item-btn btn-accept" onclick="openAcceptModal(${item.id}, '${item.stage_name}', ${item.start}, ${item.end}, ${item.layer})">✅ Принять</button>
                        <button class="item-btn btn-reject" onclick="openRejectModal(${item.id}, '${item.stage_name}', ${item.start}, ${item.end}, ${item.layer})">❌ Отклонить</button>
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${item.stage_name}</span>
                </div>
                <div class="item-details">
                    <p>📏 ПК${item.start} - ПК${item.end}</p>
                    ${item.layer > 1 ? `<p>🔹 Слой: ${item.layer}</p>` : ''}
                    <p>📅 ${item.date}</p>
                </div>
                ${actions}
            `;
            list.appendChild(card);
        });
    } else {
        list.innerHTML = '<div class="item-card">📭 Нет готовых участков</div>';
    }
}

// Загрузка сданных участков
async function loadAccepted() {
    const list = document.getElementById('acceptedList');
    list.innerHTML = '<div class="loading">Загрузка истории сдачи...</div>';
    
    const response = await sendAction('get_accepted');
    
    if (response.data && response.data.length > 0) {
        list.innerHTML = '';
        response.data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${item.stage_name}</span>
                    <span class="item-badge" style="background: ${item.status === 'принято' ? '#2ecc71' : '#e74c3c'}">${item.status}</span>
                </div>
                <div class="item-details">
                    <p>📏 ПК${item.start} - ПК${item.end}</p>
                    ${item.layer > 1 ? `<p>🔹 Слой: ${item.layer}</p>` : ''}
                    <p>📅 ${item.date}</p>
                    ${item.reason ? `<p>❌ Причина: ${item.reason}</p>` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    } else {
        list.innerHTML = '<div class="item-card">📭 Нет сданных участков</div>';
    }
}

// Загрузка статистики
async function loadStats() {
    const container = document.getElementById('statsContent');
    container.innerHTML = '<div class="loading">Загрузка статистики...</div>';
    
    const response = await sendAction('get_stats');
    
    if (response.data) {
        const stats = response.data;
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.total_stages}</div>
                    <div class="stat-label">Этапов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.ready_count}</div>
                    <div class="stat-label">Готовых</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.accepted_count}</div>
                    <div class="stat-label">Сдано</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.employees_count}</div>
                    <div class="stat-label">Сотрудников</div>
                </div>
            </div>
        `;
        
        if (stats.stage_progress && stats.stage_progress.length > 0) {
            html += '<h3 style="margin: 20px 0 10px;">📊 Прогресс по типам работ</h3>';
            stats.stage_progress.forEach(item => {
                html += `
                    <div class="item-card">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>${item.emoji || '📌'} ${item.name}</span>
                            <span>${item.percent}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${item.percent}%"></div>
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
    }
}

// Загрузка сотрудников
async function loadEmployees() {
    const list = document.getElementById('employeesList');
    list.innerHTML = '<div class="loading">Загрузка сотрудников...</div>';
    
    const response = await sendAction('get_employees');
    
    if (response.data && response.data.length > 0) {
        list.innerHTML = '';
        response.data.forEach(emp => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${emp.name}</span>
                    <span class="item-badge">${emp.position}</span>
                </div>
                <div class="item-details">
                    <p>📞 ${emp.phone}</p>
                    <p>📅 ${emp.date}</p>
                </div>
            `;
            list.appendChild(card);
        });
    } else {
        list.innerHTML = '<div class="item-card">📭 Нет сотрудников</div>';
    }
}

// Загрузка этапов для select
async function loadStagesForSelect() {
    const select = document.getElementById('readyStageSelect');
    select.innerHTML = '<option>Загрузка...</option>';
    
    const response = await sendAction('get_stages_for_select');
    
    if (response.data && response.data.length > 0) {
        select.innerHTML = '';
        response.data.forEach(stage => {
            const option = document.createElement('option');
            option.value = stage.id;
            option.textContent = `${stage.name} | ПК${stage.start}-ПК${stage.end} (${stage.layers} слоев)`;
            option.dataset.name = stage.name;
            option.dataset.layers = stage.layers;
            select.appendChild(option);
        });
    } else {
        select.innerHTML = '<option>Нет доступных этапов</option>';
    }
}

// Добавление этапа
async function addStage() {
    console.log("📝 Попытка создания этапа");
    
    const name = document.getElementById('stageType').value;
    const start = parseInt(document.getElementById('stageStart').value);
    const end = parseInt(document.getElementById('stageEnd').value);
    const layers = parseInt(document.getElementById('stageLayers').value);
    
    if (!start || !end) {
        tg.showPopup({ message: 'Введите начальный и конечный пикеты' });
        return;
    }
    
    if (start < 1400 || end > 1900 || start > end) {
        tg.showPopup({ message: 'Некорректный диапазон пикетов (должен быть от 1400 до 1900)' });
        return;
    }
    
    if (layers < 1 || layers > 3) {
        tg.showPopup({ message: 'Количество слоев должно быть от 1 до 3' });
        return;
    }
    
    const btn = document.getElementById('createStageBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Отправка...';
    btn.disabled = true;
    
    try {
        const response = await sendAction('add_stage', {
            name: name,
            start: start,
            end: end,
            layers: layers
        });
        
        if (response.success) {
            tg.HapticFeedback.notificationOccurred('success');
            closeModal('addStageModal');
            loadStages();
            tg.showPopup({ message: '✅ Этап успешно создан!' });
            
            document.getElementById('stageStart').value = '';
            document.getElementById('stageEnd').value = '';
            document.getElementById('stageLayers').value = '1';
        } else {
            tg.showPopup({ message: '❌ Ошибка при создании этапа' });
        }
    } catch (error) {
        tg.showPopup({ message: '❌ Ошибка связи с ботом' });
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Добавление готового участка
async function addReady() {
    const select = document.getElementById('readyStageSelect');
    if (!select.value) {
        tg.showPopup({ message: 'Выберите этап' });
        return;
    }
    
    const stageId = parseInt(select.value);
    const stageName = select.options[select.selectedIndex].dataset.name;
    const start = parseInt(document.getElementById('readyStart').value);
    const end = parseInt(document.getElementById('readyEnd').value);
    const layer = parseInt(document.getElementById('readyLayer').value);
    
    if (!start || !end) {
        tg.showPopup({ message: 'Введите пикеты' });
        return;
    }
    
    const btn = document.getElementById('createReadyBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Отправка...';
    btn.disabled = true;
    
    const response = await sendAction('add_ready', {
        stage_id: stageId,
        stage_name: stageName,
        start: start,
        end: end,
        layer: layer
    });
    
    if (response.success) {
        tg.HapticFeedback.notificationOccurred('success');
        closeModal('addReadyModal');
        loadReady();
        tg.showPopup({ message: '✅ Участок отмечен!' });
    }
    
    btn.textContent = originalText;
    btn.disabled = false;
}

// Добавление сотрудника
async function addEmployee() {
    const name = document.getElementById('employeeName').value;
    const position = document.getElementById('employeePosition').value;
    const phone = document.getElementById('employeePhone').value;
    
    if (!name || !phone) {
        tg.showPopup({ message: 'Заполните все поля' });
        return;
    }
    
    const btn = document.getElementById('createEmployeeBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Отправка...';
    btn.disabled = true;
    
    const response = await sendAction('add_employee', {
        name: name,
        position: position,
        phone: phone
    });
    
    if (response.success) {
        tg.HapticFeedback.notificationOccurred('success');
        closeModal('addEmployeeModal');
        loadEmployees();
        tg.showPopup({ message: '✅ Сотрудник добавлен!' });
        
        document.getElementById('employeeName').value = '';
        document.getElementById('employeePhone').value = '';
    }
    
    btn.textContent = originalText;
    btn.disabled = false;
}

// Открытие модалки принятия
function openAcceptModal(id, name, start, end, layer) {
    selectedSectionId = id;
    document.getElementById('acceptInfo').textContent = 
        `${name} | ПК${start}-ПК${end}${layer > 1 ? ` (слой ${layer})` : ''}`;
    openModal('acceptModal');
}

// Открытие модалки отклонения
function openRejectModal(id, name, start, end, layer) {
    selectedSectionId = id;
    document.getElementById('rejectInfo').textContent = 
        `${name} | ПК${start}-ПК${end}${layer > 1 ? ` (слой ${layer})` : ''}`;
    openModal('rejectModal');
}

// Принятие участка
async function acceptSection() {
    const btn = document.getElementById('acceptBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Отправка...';
    btn.disabled = true;
    
    const response = await sendAction('accept_section', {
        section_id: selectedSectionId
    });
    
    if (response.success) {
        tg.HapticFeedback.notificationOccurred('success');
        closeModal('acceptModal');
        loadReady();
        tg.showPopup({ message: '✅ Участок принят!' });
    }
    
    btn.textContent = originalText;
    btn.disabled = false;
}

// Отклонение участка
async function rejectSection() {
    const reason = document.getElementById('rejectReason').value;
    
    if (!reason) {
        tg.showPopup({ message: 'Укажите причину отклонения' });
        return;
    }
    
    const btn = document.getElementById('rejectBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Отправка...';
    btn.disabled = true;
    
    const response = await sendAction('reject_section', {
        section_id: selectedSectionId,
        reason: reason
    });
    
    if (response.success) {
        tg.HapticFeedback.notificationOccurred('success');
        closeModal('rejectModal');
        loadReady();
        tg.showPopup({ message: '❌ Участок отклонен' });
        document.getElementById('rejectReason').value = '';
    }
    
    btn.textContent = originalText;
    btn.disabled = false;
}

// Управление модальными окнами
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Загружаем начальную секцию
loadSection('stages');

// Кнопка назад
tg.BackButton.show();
tg.BackButton.onClick(() => tg.close());
