/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // purchase — это одна из записей в поле items из чека в data.purchase_records
    // _product — это продукт из коллекции data.products
    
    const { discount = 0, sale_price, quantity } = purchase;
    
    // Если нет цены продажи или количества, возвращаем 0
    if (!sale_price || !quantity) return 0;
    
    // Рассчитываем выручку с учетом скидки
    const revenueSku = sale_price * quantity * (1 - (discount || 0) / 100);
    return revenueSku;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const { profit } = seller;
    let bonusPercentage = 0;
    
    if (index === 0) {
        /// Первый продавец - 15%
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        /// Второй и третий - 10%
        bonusPercentage = 0.10;
    } else if (index < total - 1) {
        /// Четвертый и далее (кроме последнего) - 5%
        bonusPercentage = 0.05;
    }
    /// Последний продавец (index === total - 1) - 0%

    /// Возвращаем бонус, округленный до целого числа
    return seller.profit * bonusPercentage;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    const { calculateRevenue, calculateBonus } = options;
    if (!data || !options) {
        throw new Error('Некорректные входные данные');
    }

    if (typeof options.calculateRevenue !== 'function' || typeof options.calculateBonus !== 'function') {
        throw new Error('Опции должны содержать функции calculateRevenue и calculateBonus');
    }

    // Проверка на пустые массивы
    if (!data.sellers || data.sellers.length === 0) {
        throw new Error('Массив sellers не может быть пустым');
    }
    
    if (!data.products || data.products.length === 0) {
        throw new Error('Массив products не может быть пустым');
    }
    
    if (!data.purchase_records || data.purchase_records.length === 0) {
        throw new Error('Массив purchase_records не может быть пустым');
    }

    // Подготовка данных
    const sellersMap = {};
    const productsMap = {};
    const sellerStats = {};

    // Индексация продавцов
    data.sellers.forEach(function(seller) {
        sellersMap[seller.id] = seller;
        sellerStats[seller.id] = {
            seller_id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            sales_count: 0,
            revenue: 0,
            profit: 0,
            top_products: {},
            bonus: 0
        };
    });

    // Индексация товаров
    data.products.forEach(function(product) {
        productsMap[product.sku] = product;
    });

    // Обработка покупок
    data.purchase_records.forEach(function(purchase) {
        const sellerId = purchase.seller_id;
        const sellerStat = sellerStats[sellerId];
        
        if (!sellerStat) return;

        sellerStat.sales_count += 1;

        purchase.items.forEach(function(item) {
            const product = productsMap[item.sku];
            if (!product) return;

            // Создаем объект для расчета выручки
            const purchaseItem = {
                discount: item.discount || 0,
                sale_price: item.sale_price,
                quantity: item.quantity
            };

            // Расчет выручки
            const revenue = options.calculateRevenue(purchaseItem, product);
            
            // Расчет прибыли (выручка - себестоимость)
            const cost = product.purchase_price * item.quantity;
            const profit = revenue - cost;

            // Обновление статистики
            sellerStat.revenue += +revenue.toFixed(2);
            sellerStat.profit += profit;

            // Обновление топовых товаров
            if (!sellerStat.top_products[item.sku]) {
                sellerStat.top_products[item.sku] = {
                    sku: item.sku,
                    quantity: 0
                };
            }
            sellerStat.top_products[item.sku].quantity += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли
    const sortedSellers = Object.values(sellerStats).sort((a, b) => b.profit - a.profit);

    // Расчет бонусов
    const totalSellers = sortedSellers.length;
    sortedSellers.forEach((seller, index) => {
        seller.bonus = options.calculateBonus(index, totalSellers, seller);
    });

    // Подготовка результата
    return sortedSellers.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: Object.values(seller.top_products)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10),
        bonus: +seller.bonus.toFixed(2)
    }));
}