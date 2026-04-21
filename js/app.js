/**
 * Конфигурация Google Sheets
 * 
 * 1. Создайте Google Sheet с такими столбцами:
 *    A: ID (не используется, можно оставить пустым)
 *    B: Публикация (1 = показывать, 0 = скрыть)
 *    C: Наименование
 *    D: Каталожный номер
 *    E: Цена
 *    F: Категория (engine, transmission, brakes, suspension, electrical)
 * 
 * 2. Опубликуйте таблицу: Файл → Опубликовать в интернете → CSV
 * 3. Скопируйте ссылку и вставьте ниже
 */

const CONFIG = {
    // ЗАМЕНИТЕ ЭТУ ССЫЛКУ на вашу CSV-ссылку из Google Sheets
    SHEET_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqoUEksexahz9qmPIH4tnt7_pv0s0zuioF43jt9ftE264RW8MlRomCK8F-2GEz_w/pub?gid=549941518&single=true&output=csv',
    
    // Или используйте CORS-прокси если нужно (например: https://corsproxy.io/?)
    CORS_PROXY: '',
    
    // Настройки категорий
    CATEGORIES: {
        'engine': 'Двигатель',
        'transmission': 'Трансмиссия',
        'brakes': 'Тормоза',
        'suspension': 'Подвеска',
        'electrical': 'Электрика'
    }
};

// Состояние приложения
let allProducts = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM элементы
const grid = document.getElementById('catalogGrid');
const searchInput = document.getElementById('searchInput');
const statsBar = document.getElementById('statsBar');
const totalCount = document.getElementById('totalCount');
const emptyState = document.getElementById('emptyState');
const filterBtns = document.querySelectorAll('.filter-btn');
const modal = document.getElementById('orderModal');
const modalClose = document.getElementById('modalClose');
const modalProduct = document.getElementById('modalProduct');
const orderForm = document.getElementById('orderForm');

/**
 * Парсинг CSV с учетом кавычек
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] ? values[i].replace(/^"|"$/g, '') : '';
        });
        return obj;
    });
}

/**
 * Загрузка данных из Google Sheets
 */
async function loadProducts() {
    try {
        const url = CONFIG.CORS_PROXY + CONFIG.SHEET_URL;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        // Фильтруем: только опубликованные (колонка B = 1)
        // Структура: A-ID, B-Публикация, C-Наименование, D-Номер, E-Цена, F-Категория
        allProducts = data
            .filter(row => row['Публикация'] === '1' || row['B'] === '1')
            .map(row => ({
                name: row['Наименование'] || row['C'] || '',
                number: row['Каталожный номер'] || row['D'] || '',
                price: parseFloat((row['Цена'] || row['E'] || '0').replace(/\s/g, '').replace(',', '.')) || 0,
                category: (row['Категория'] || row['F'] || 'other').toLowerCase(),
                published: true
            }))
            .filter(p => p.name && p.price > 0);
        
        renderProducts();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        grid.innerHTML = `
            <div class="loading" style="grid-column: 1/-1;">
                <p style="color: #dc2626;">⚠️ Ошибка загрузки каталога</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Проверьте подключение к интернету и настройки Google Sheets</p>
                <button onclick="loadProducts()" style="margin-top: 16px; padding: 8px 16px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: white;">Повторить</button>
            </div>
        `;
    }
}

/**
 * Форматирование цены
 */
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

/**
 * Получение названия категории
 */
function getCategoryName(cat) {
    return CONFIG.CATEGORIES[cat] || 'Другое';
}

/**
 * Рендеринг товаров
 */
function renderProducts() {
    let filtered = allProducts;
    
    // Фильтр по категории
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    // Поиск
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(q) || 
            p.number.toLowerCase().includes(q)
        );
    }
    
    // Обновляем счетчик
    totalCount.textContent = `Найдено: ${filtered.length} из ${allProducts.length} товаров`;
    
    // Показываем/скрываем empty state
    if (filtered.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
    
    // Рендерим карточки
    grid.innerHTML = filtered.map(product => `
        <article class="card" data-id="${product.number}">
            <div class="card-header">
                <span class="card-category">${getCategoryName(product.category)}</span>
                <span class="card-number">${product.number}</span>
            </div>
            <h3 class="card-title">${product.name}</h3>
            <div class="card-price">
                ${formatPrice(product.price)} <span class="currency">₽</span>
            </div>
            <button class="btn-order" onclick="openOrder('${product.number.replace(/'/g, "\\'")}', '${product.name.replace(/'/g, "\\'")}', ${product.price})">
                Заказать
            </button>
        </article>
    `).join('');
}

/**
 * Открытие модального окна заказа
 */
function openOrder(number, name, price) {
    modalProduct.innerHTML = `
        <h4>${name}</h4>
        <p>Каталожный номер: ${number}</p>
        <div class="price">${formatPrice(price)} ₽</div>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Закрытие модального окна
 */
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    orderForm.reset();
}

// Обработчики событий

// Поиск
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProducts();
});

// Фильтры
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderProducts();
    });
});

// Модальное окно
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Отправка формы
orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(orderForm);
    const data = Object.fromEntries(formData);
    
    // Здесь можно добавить отправку на сервер или в Telegram
    alert('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
    closeModal();
});

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Инициализация
document.addEventListener('DOMContentLoaded', loadProducts);
