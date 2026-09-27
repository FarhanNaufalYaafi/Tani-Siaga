<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { showAlert, showConfirm, showInput } from '$lib/services/dialog';
	import { getFarmlandById, deleteFarmland, replantFarmland, updateFarmland, type Farmland, type FarmlandPayload } from '$lib/api/farmland-api';
	 import { getCommodities, type Commodity } from '$lib/api/commodity-api';
	import { getFarmlandWeather, type WeatherForecast } from '$lib/api/farmland-api';
	import { getFarmlandMarketAnalysis, getFarmlandRecommendation, type AiRecommendation, type MarketAnalysis } from '$lib/api/ai-api';
	import { completeFarmlandHarvest } from '$lib/api/product-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';

	let farmland = $state<Farmland | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	 let currentUser = $state<CurrentUserDto | null>(null);
	 let isDeleting = $state(false);
	 let deleteMessage = $state('');
	let forecasts = $state<WeatherForecast[]>([]);
	let recommendation = $state<AiRecommendation | null>(null);
	let marketAnalysis = $state<MarketAnalysis | null>(null);
	let insightLoading = $state(true);
	let insightMessage = $state('');
	let weatherRange = $state<'today' | 'tomorrow' | 'later'>('today');
	let activeInsightTab = $state<'market' | 'recommendation'>('recommendation');
	let insightAttempts = $state(0);
	let isEditing = $state(false);
	let isReplanting = $state(false);
	let isHarvesting = $state(false);
	let isSaving = $state(false);
	let editForm = $state<Partial<FarmlandPayload>>({});
	let commodities = $state<Commodity[]>([]);

	onMount(() => {
		void loadFarmland();
	});

	async function loadFarmland() {
		const farmlandId = page.params.id;
		if (!farmlandId) {
			errorMessage = 'ID lahan tani tidak ditemukan.';
			isLoading = false;
			return;
		}

		 try {
			 [farmland, currentUser] = await Promise.all([getFarmlandById(farmlandId), getCurrentUser()]);
			 commodities = await getCommodities();
			 editForm = toEditForm(farmland);
			 if (farmland.status !== 'harvested') await loadInsights(farmlandId);
			 else insightLoading = false;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat detail lahan tani.';
		} finally {
			isLoading = false;
		}
	}

	function toEditForm(value: Farmland): Partial<FarmlandPayload> {
		return { name: value.name, area_size: Number(value.area_size), adm4_code: value.adm4_code || '', address_detail: value.address_detail || '', plant_date: value.plant_date || '', plant_method: value.plant_method || '', commodity_id: value.commodity?.id, expected_yield_user_kg: value.expected_yield_user_kg ? Number(value.expected_yield_user_kg) : undefined, custom_avg_harvest_days: value.custom_avg_harvest_days ? Number(value.custom_avg_harvest_days) : undefined, custom_max_humidity_percentage: value.custom_max_humidity_percentage ? Number(value.custom_max_humidity_percentage) : undefined, custom_max_temp_celsius: value.custom_max_temp_celsius ? Number(value.custom_max_temp_celsius) : undefined, custom_min_temp_celsius: value.custom_min_temp_celsius ? Number(value.custom_min_temp_celsius) : undefined, latitude: value.latitude ? Number(value.latitude) : undefined, longitude: value.longitude ? Number(value.longitude) : undefined };
	}

	async function saveFarmland() {
		if (!farmland) return;
		isSaving = true; errorMessage = ''; deleteMessage = '';
		try {
			const payload = { ...editForm, area_size: Number(editForm.area_size), commodity_id: editForm.commodity_id || undefined };
			if (isReplanting) {
				farmland = await replantFarmland(farmland.id, payload);
				isReplanting = false;
				notice = 'Lahan mulai ditanami kembali. Prakiraan BMKG dan analisis baru sedang disiapkan.';
				forecasts = []; recommendation = null; marketAnalysis = null;
				insightMessage = 'Data untuk musim tanam baru sedang diproses.';
			} else {
				farmland = await updateFarmland(farmland.id, payload);
				notice = 'Perubahan lahan berhasil diterapkan. Rekomendasi AI dan analisis pasar sedang diperbarui.';
			}
			isEditing = false;
			insightAttempts = 0; void loadInsights(String(farmland.id));
		} catch (error: any) { errorMessage = error.message || 'Gagal memperbarui lahan tani.'; }
		finally { isSaving = false; }
	}

	function isFarmlandHarvested() {
		return farmland?.status === 'harvested';
	}

	async function loadInsights(id: string) {
		if (isFarmlandHarvested()) { insightLoading = false; return; }
		insightLoading = true;
		const results = await Promise.allSettled([getFarmlandWeather(id), getFarmlandRecommendation(id), getFarmlandMarketAnalysis(id)]);
		if (isFarmlandHarvested()) { insightLoading = false; return; }
		if (results[0].status === 'fulfilled') forecasts = results[0].value.forecasts || [];
		if (results[1].status === 'fulfilled') recommendation = results[1].value;
		if (results[2].status === 'fulfilled') marketAnalysis = results[2].value;
		if (!recommendation && !marketAnalysis) insightMessage = 'Analisis sedang diproses. Muat ulang beberapa saat lagi untuk melihat hasilnya.';
		insightLoading = false;
		insightAttempts += 1;
		if ((!recommendation || !marketAnalysis) && insightAttempts < 12) setTimeout(() => void loadInsights(id), 3000);
	}

	let visibleForecasts = $derived.by(() => {
		if (weatherRange === 'today') return forecasts.slice(0, 4);
		if (weatherRange === 'tomorrow') return forecasts.slice(4, 8);
		return forecasts.slice(8, 12);
	});

	function formatForecastDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
	}

	function formatYield(value: number | string | null | undefined) {
		if (value == null || value === '') return 'Belum tersedia';
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return 'Belum tersedia';
		return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(numericValue)} kg`;
	}

	function handleInsightTabKey(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		activeInsightTab = activeInsightTab === 'market' ? 'recommendation' : 'market';
		requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-insight-tab="${activeInsightTab}"]`)?.focus());
	}

	function startReplanting() {
		if (!farmland) return;
		editForm = {
			...toEditForm(farmland),
			commodity_id: undefined,
			plant_date: '',
			plant_method: '',
			expected_yield_user_kg: undefined,
			custom_avg_harvest_days: undefined,
			custom_max_humidity_percentage: undefined,
			custom_max_temp_celsius: undefined,
			custom_min_temp_celsius: undefined,
		};
		isReplanting = true;
		isEditing = true;
		errorMessage = '';
	}

	function selectedCommodity() {
		return commodities.find((commodity) => commodity.id === Number(editForm.commodity_id));
	}

	function applyCommodityDefaults() {
		if (!isReplanting) return;
		const commodity = selectedCommodity();
		if (!commodity) return;
		editForm.custom_avg_harvest_days = commodity.avg_harvest_days;
		editForm.custom_max_humidity_percentage = commodity.max_humidity_percentage;
		editForm.custom_min_temp_celsius = commodity.min_temp_celsius;
		editForm.custom_max_temp_celsius = commodity.max_temp_celsius;
	}

	let canManage = $derived.by(() => {
		if (!farmland || !currentUser) return false;
		const currentUserId = currentUser.id ?? currentUser.userId;
		const isOwner = Number(farmland.user?.id) === Number(currentUserId);
		const farmlandGroupId = farmland.farmer_group_id ?? farmland.farmerGroup?.id;
		const isGroupLeader = currentUser.role === 'group_leader' && Number(currentUser.farmer_group_id) === Number(farmlandGroupId);
		return currentUser.role === 'admin' || (farmlandGroupId ? isGroupLeader : isOwner);
	});
	let notice = $state('');

	async function handleHarvest() {
		if (!farmland || !canManage || farmland.status === 'harvested') return;
		const estimate = Number(farmland.ai_estimated_yield_kg ?? farmland.expected_yield_user_kg ?? 0);
		const input = await showInput({
			title: 'Catat panen lahan',
			message: 'Masukkan hasil panen aktual. Produk pre-order dari lahan ini akan berpindah menjadi ready stock dan pembeli yang booking akan diberi kabar.',
			input: { label: 'Hasil panen aktual (kg)', type: 'number', value: String(Math.max(0, Math.round(estimate))), min: 0, step: 1, required: true },
			confirmLabel: 'Tandai sudah panen',
		});
		if (input === null) return;
		const actualYield = Number(input);
		if (!Number.isInteger(actualYield) || actualYield < 0) {
			await showAlert('Hasil panen harus berupa bilangan bulat kilogram yang tidak negatif.', { title: 'Hasil panen tidak valid', tone: 'error' });
			return;
		}

		isHarvesting = true;
		errorMessage = '';
		try {
			const result = await completeFarmlandHarvest(farmland.id, actualYield);
			farmland = await getFarmlandById(farmland.id);
			forecasts = []; recommendation = null; marketAnalysis = null;
			insightMessage = 'Prakiraan cuaca dan analisis dijeda sampai lahan ditanami kembali.';
			insightLoading = false;
			notice = result.message || 'Lahan ditandai sudah panen.';
		} catch (error: any) {
			await showAlert(error.message || 'Gagal mencatat panen lahan.', { title: 'Panen gagal dicatat', tone: 'error' });
		} finally { isHarvesting = false; }
	}

	async function handleDelete() {
		if (!farmland) return;
		const confirmed = await showConfirm(`Lahan "${farmland.name}" akan dihapus.`, { title: 'Hapus lahan?', confirmLabel: 'Hapus', tone: 'error' });
		if (!confirmed) return;
		isDeleting = true; deleteMessage = '';
		try {
			await deleteFarmland(farmland.id);
			deleteMessage = 'Lahan berhasil dihapus.';
			farmland = null;
		} catch (error: any) {
			deleteMessage = error.message || 'Gagal menghapus lahan tani.';
		} finally { isDeleting = false; }
	}
</script>

<svelte:head>
	<title>{farmland ? `${farmland.name} | Lahan Tani` : 'Detail Lahan Tani'}</title>
</svelte:head>

<div class="page-shell">
	<div class="page-container">
		<a class="back-link" href="/lahan-tani">← Kembali ke Lahan Tani</a>

		{#if isLoading}
			<div class="state-box">Memuat detail lahan...</div>
		{:else if errorMessage}
			<div class="state-box error"><p>{errorMessage}</p></div>
		{:else if farmland}
			<section class="insight-layout">
				<div class="insight-column">
					{#if farmland.status === 'harvested'}
						<div class="insight-card paused-card"><span class="pause-mark">Ⅱ</span><p class="eyebrow">SIKLUS TANAM SELESAI</p><h2>Prakiraan BMKG dijeda</h2><p>Cuaca dan rekomendasi aksi akan aktif kembali setelah lahan ditanami ulang dengan komoditas baru.</p></div>
					{:else}
					<div class="insight-card">
						<div class="insight-heading"><div><span class="source-logo bmkg-logo" aria-label="Logo BMKG">BMKG</span><p class="eyebrow">PRAKIRAAN CUACA</p><h2>Cuaca di lahanmu</h2></div><span class="source-note">Sumber: BMKG</span></div>
						{#if insightLoading}<p class="muted">Memuat prakiraan cuaca...</p>{:else if forecasts.length === 0}<p class="muted">Prakiraan cuaca belum tersedia.</p>{:else}<div class="weather-tabs"><button class:active={weatherRange === 'today'} onclick={() => (weatherRange = 'today')}>Beberapa jam</button><button class:active={weatherRange === 'tomorrow'} onclick={() => (weatherRange = 'tomorrow')}>Hari berikutnya</button><button class:active={weatherRange === 'later'} onclick={() => (weatherRange = 'later')}>Hari setelahnya</button></div><div class="weather-list">{#each visibleForecasts as weather}<div class="weather-row"><div><strong>{formatForecastDate(weather.datetime)}</strong><span>{weather.weather_name}</span></div><div class="weather-main"><strong>{weather.temperature}°C</strong><span>Hujan {weather.precipitation} mm</span></div><div class="weather-meta"><span>💧 {weather.humidity}%</span><span>Angin {weather.wind_speed} km/j</span></div></div>{/each}</div><footer class="source-footer">Data prakiraan cuaca © Badan Meteorologi, Klimatologi, dan Geofisika (BMKG).</footer>{/if}
					</div>
					{/if}
				</div>

				<article class="detail-card">
					<div class="detail-header">
						<div><p class="eyebrow">DETAIL LAHAN TANI</p><h1>{farmland.name}</h1><p class="muted">Informasi lahan yang terhubung dengan akunmu.</p><span class:harvested={farmland.status === 'harvested'} class="farmland-status">{farmland.status === 'harvested' ? 'SUDAH PANEN' : 'AKTIF DITANAMI'}</span></div>
						<span class="crop-mark" aria-hidden="true">🌾</span>
					</div>
					<div class="yield-summary">
						<div><span>Perkiraan potensi panen</span><strong>{formatYield(farmland.ai_estimated_yield_kg ?? farmland.expected_yield_user_kg)}</strong></div>
						<p>{farmland.ai_estimated_yield_kg != null ? 'Estimasi awal berdasarkan luas lahan dan/atau input petani; belum dikoreksi dampak cuaca Gemini.' : farmland.expected_yield_user_kg != null ? 'Berdasarkan input petani; hasil aktual dapat berubah mengikuti kondisi lahan, cuaca, dan perawatan.' : 'Estimasi belum tersedia. Hasil aktual dipengaruhi kondisi lahan, cuaca, dan perawatan.'}</p>
					</div>
					{#if deleteMessage}<div class:error={deleteMessage.includes('Gagal')} class="notice">{deleteMessage}</div>{/if}
					{#if notice}<div class="notice">{notice}</div>{/if}
					{#if errorMessage}<div class="notice error">{errorMessage}</div>{/if}
					{#if isEditing}
						<form class="inline-edit" onsubmit={(event) => { event.preventDefault(); void saveFarmland(); }}>
							<div class="edit-intro"><div><p class="eyebrow">{isReplanting ? 'MUSIM TANAM BARU' : 'PERBARUI DATA'}</p><h2>{isReplanting ? 'Siapkan lahan untuk ditanami' : 'Edit informasi lahan'}</h2></div><span>{isReplanting ? 'Pilih komoditas dan isi detail tanam yang baru.' : 'Perubahan akan memperbarui analisis lahan.'}</span></div>
							<div class="edit-grid">
								<label>Nama lahan<input bind:value={editForm.name} required /></label>
								<label>Luas area (m²)<input type="number" min="0.01" step="0.01" bind:value={editForm.area_size} required /></label>
								<label>Metode tanam<input bind:value={editForm.plant_method} required /></label>
								<label>Tanggal tanam<input type="date" bind:value={editForm.plant_date} required={isReplanting} /></label>
								<label>Komoditas<select bind:value={editForm.commodity_id} required={isReplanting} onchange={applyCommodityDefaults}><option value={undefined}>Belum ditentukan</option>{#each commodities as item}<option value={item.id}>{item.name}{item.variety ? ` · ${item.variety}` : ''}</option>{/each}</select></label>
								<label>Estimasi hasil panen (kg)<input type="number" min="0" step="0.01" bind:value={editForm.expected_yield_user_kg} /></label>
								{#if isReplanting}
									<label>Rata-rata hari panen<input type="number" min="1" step="1" bind:value={editForm.custom_avg_harvest_days} /><small>Opsional. Default komoditas: {selectedCommodity()?.avg_harvest_days ?? '-'} hari.</small></label>
									<label>Kelembapan maksimum (%)<input type="number" min="0" max="100" step="0.1" bind:value={editForm.custom_max_humidity_percentage} /><small>Opsional. Default komoditas: {selectedCommodity()?.max_humidity_percentage ?? '-'}%.</small></label>
									<label>Suhu minimum (°C)<input type="number" step="0.1" bind:value={editForm.custom_min_temp_celsius} /><small>Opsional. Default komoditas: {selectedCommodity()?.min_temp_celsius ?? '-'}°C.</small></label>
									<label>Suhu maksimum (°C)<input type="number" step="0.1" bind:value={editForm.custom_max_temp_celsius} /><small>Opsional. Default komoditas: {selectedCommodity()?.max_temp_celsius ?? '-'}°C.</small></label>
								{/if}
								<label class="wide">Alamat detail<textarea bind:value={editForm.address_detail} rows="3"></textarea></label>
								<label class="wide">Kode wilayah ADM4<input bind:value={editForm.adm4_code} required readonly={isReplanting} /><small>{isReplanting ? 'Kode wilayah mengikuti lokasi lahan dan tidak dapat diubah.' : ''}</small></label>
							</div>
							<div class="actions"><button class="edit-button secondary" class:cancel-danger={isReplanting} type="button" onclick={() => { isEditing = false; isReplanting = false; if (farmland) editForm = toEditForm(farmland); }}>Batal</button><button class="edit-button" type="submit" disabled={isSaving}>{isSaving ? 'Menerapkan...' : isReplanting ? 'Tanami lagi' : 'Terapkan perubahan'}</button></div>
						</form>
					{:else}
						<div class="facts-grid"><div class="fact"><span>Luas area</span><strong>{farmland.area_size} m²</strong></div><div class="fact"><span>Komoditas</span><strong>{farmland.commodity?.name || 'Belum ditentukan'}</strong></div><div class="fact"><span>Metode tanam</span><strong>{farmland.plant_method || '-'}</strong></div><div class="fact"><span>Tanggal tanam</span><strong>{farmland.plant_date || '-'}</strong></div><div class="fact"><span>Pemilik</span><strong>{farmland.user?.email || '-'}</strong></div><div class="fact"><span>Kode wilayah</span><strong>{farmland.adm4_code || '-'}</strong></div></div>
						<div class="long-fact"><span>Alamat lahan</span><p>{farmland.address_detail || 'Belum ada alamat detail.'}</p></div>
						{#if canManage}<div class="actions">{#if farmland.status === 'harvested'}<button class="edit-button" type="button" onclick={startReplanting}>Tanami Lagi</button>{:else}<button class="harvest-button" type="button" onclick={handleHarvest} disabled={isHarvesting}>{isHarvesting ? 'Mencatat panen...' : 'Sudah Panen'}</button><button class="edit-button" type="button" onclick={() => { isReplanting = false; isEditing = true; }}>Ubah Lahan</button>{/if}<button class="delete-button" type="button" onclick={handleDelete} disabled={isDeleting}>{isDeleting ? 'Menghapus...' : 'Hapus Lahan'}</button></div>{/if}
					{/if}
				</article>

				<div class="insight-column">
					{#if farmland.status === 'harvested'}
						<div class="insight-card paused-card"><span class="pause-mark">Ⅱ</span><p class="eyebrow">ANALISIS DIJEDA</p><h2>Market analysis dan rekomendasi AI nonaktif</h2><p>Setelah memilih komoditas dan tanggal tanam baru, sistem akan mulai mengolah data kembali.</p></div>
					{:else}
					<div class="insight-card insight-switcher">
						<div class="insight-tabs" role="tablist" aria-label="Analisis lahan">
							<button id="insight-tab-market" data-insight-tab="market" role="tab" aria-selected={activeInsightTab === 'market'} aria-controls="insight-panel-market" tabindex={activeInsightTab === 'market' ? 0 : -1} class:active={activeInsightTab === 'market'} onkeydown={handleInsightTabKey} onclick={() => (activeInsightTab = 'market')}>Market analysis</button>
							<button id="insight-tab-recommendation" data-insight-tab="recommendation" role="tab" aria-selected={activeInsightTab === 'recommendation'} aria-controls="insight-panel-recommendation" tabindex={activeInsightTab === 'recommendation' ? 0 : -1} class:active={activeInsightTab === 'recommendation'} onkeydown={handleInsightTabKey} onclick={() => (activeInsightTab = 'recommendation')}>Rekomendasi aksi</button>
						</div>
						{#if activeInsightTab === 'market'}
							<div id="insight-panel-market" class="tab-panel market-card" role="tabpanel" aria-labelledby="insight-tab-market" tabindex="0">
								<div class="insight-heading"><div><span class="source-logo bps-logo" aria-label="Logo BPS">BPS</span><p class="eyebrow">ANALISIS PASAR</p><h2>Prospek komoditas</h2></div><span class="source-note">Data BPS & Tani Siaga</span></div>
								{#if marketAnalysis}<div class="market-stat"><span>Tren harga</span><strong>{marketAnalysis.price_trend}</strong></div><div class="market-stat"><span>Surplus wilayah</span><strong>{marketAnalysis.surplus_percentage}%</strong></div><p class="market-summary">{marketAnalysis.analysis_summary}</p>{#if marketAnalysis.prediction_meta?.weather_impact_assessment}<div class="market-highlight"><strong>Dampak cuaca pada potensi panen</strong><br />{marketAnalysis.prediction_meta.weather_impact_assessment}</div>{/if}{#if marketAnalysis.prediction_meta?.simple_summary_for_farmers}<div class="market-highlight">{marketAnalysis.prediction_meta.simple_summary_for_farmers}</div>{/if}{:else}<p class="muted">{insightMessage || 'Analisis pasar sedang diproses setelah lahan dibuat.'}</p>{/if}
								<footer>Data statistik pertanian bersumber dari Badan Pusat Statistik (BPS). Analisis merupakan estimasi pendukung keputusan.</footer>
							</div>
						{:else}
							<div id="insight-panel-recommendation" class="tab-panel ai-card" role="tabpanel" aria-labelledby="insight-tab-recommendation" tabindex="0">
								<div class="insight-heading"><div><span class="source-logo ai-logo">AI</span><p class="eyebrow">PENDAMPING LAHAN · GEMINI</p><h2>Rekomendasi aksi</h2></div><span class="action-badge">{recommendation?.action_type || 'MENUNGGU'}</span></div>
								{#if recommendation}<h3>{recommendation.summary}</h3><p>{recommendation.detailed_advice}</p><ol>{#each recommendation.step_by_step_steps || [] as step}<li>{step}</li>{/each}</ol>{:else}<p class="muted">{insightMessage || 'Rekomendasi sedang diproses.'}</p><button class="refresh-button" type="button" onclick={() => { insightAttempts = 0; if (farmland) void loadInsights(String(farmland.id)); }}>Perbarui analisis</button>{/if}
							</div>
						{/if}
					</div>
					{/if}
				</div>
			</section>
		{:else if deleteMessage}
			<div class="state-box"><p>{deleteMessage}</p><a class="back-link" href="/lahan-tani">Kembali ke Lahan Tani</a></div>
		{/if}
	</div>
</div>

<style>
	.page-shell { min-height: 100vh; background: #f4f7f1; color: #183126; padding: 32px 20px 64px; }
	.page-container { max-width: 1440px; margin: 0 auto; }
	.back-link { display: inline-block; margin-bottom: 22px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.detail-card, .state-box { border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 24px; box-shadow: 0 8px 22px rgba(35, 71, 46, .06); }
	.detail-header { display: flex; justify-content: space-between; gap: 20px; align-items: start; padding-bottom: 24px; border-bottom: 1px solid #e8eee6; }
	.eyebrow { margin: 0 0 8px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
	h1 { margin: 0; font-size: clamp(28px, 5vw, 42px); line-height: 1.1; }
	.inline-edit { padding-top: 22px; }
	.edit-intro { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-bottom: 20px; padding: 16px; border: 1px solid #dcebd8; border-radius: 9px; background: #f4faf2; }
	.edit-intro .eyebrow { margin-bottom: 5px; }
	.edit-intro h2 { margin: 0; color: #274a32; font-size: 19px; }
	.edit-intro > span { color: #718077; font-size: 12px; text-align: right; }
	.edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.edit-grid label { display: grid; gap: 7px; color: #385540; font-size: 12px; font-weight: 700; }
	.edit-grid .wide { grid-column: 1 / -1; }
	.edit-grid input, .edit-grid select, .edit-grid textarea { width: 100%; box-sizing: border-box; border: 1px solid #d6e1d5; border-radius: 7px; background: #fbfdfb; color: #183126; padding: 11px 12px; font: inherit; font-size: 13px; outline: none; transition: border-color .15s, box-shadow .15s; }
	.edit-grid textarea { resize: vertical; min-height: 78px; }
	.edit-grid input:focus, .edit-grid select:focus, .edit-grid textarea:focus { border-color: #5c9568; box-shadow: 0 0 0 3px rgba(92, 149, 104, .12); }
	.muted, .state-box p { color: #718077; font-size: 14px; }
	.crop-mark { font-size: 38px; }
	.farmland-status { display: inline-block; margin-top: 10px; border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 6px 9px; font-size: 10px; font-weight: 800; }
	.farmland-status.harvested { background: #eaf4e9; color: #39754b; }
	.facts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; padding: 24px 0; }
	.fact { background: #f7faf6; border: 1px solid #e5ede3; border-radius: 8px; padding: 14px; }
	.fact span, .long-fact span { display: block; color: #718077; font-size: 12px; margin-bottom: 7px; }
	.fact strong { color: #274a32; font-size: 14px; overflow-wrap: anywhere; }
	.long-fact { border-top: 1px solid #e8eee6; padding-top: 20px; }
	.long-fact p { margin: 0; color: #304d38; line-height: 1.6; }
	.yield-summary { display: grid; gap: 8px; margin-top: 18px; padding: 16px; border-left: 3px solid #bd8035; background: #fff8e8; }
	.yield-summary span { display: block; color: #718077; font-size: 12px; }
	.yield-summary strong { display: block; margin-top: 4px; color: #875c22; font-size: 25px; }
	.yield-summary p { margin: 0; color: #796746; font-size: 10px; line-height: 1.5; }
	.actions { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e8eee6; margin-top: 22px; padding-top: 20px; }
	.edit-button, .delete-button { border: 0; border-radius: 7px; padding: 10px 14px; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; }
	.edit-button { background: #eaf4e9; color: #39754b; }.edit-button.secondary { border: 1px solid #d6e1d5; background: #fff; color: #52705a; }.edit-button:disabled { opacity: .6; cursor: wait; }.delete-button { background: #fff0ef; color: #a44242; }.delete-button:disabled { opacity: .6; cursor: not-allowed; }
	.edit-button.cancel-danger { border-color: #e6b8b3; background: #fff0ef; color: #a44242; }
	.harvest-button { border: 0; border-radius: 7px; background: #bd8035; color: #fff; padding: 10px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
	.harvest-button:disabled { opacity: .6; cursor: wait; }
	.notice { margin-top: 18px; border-radius: 7px; background: #edf8ed; color: #39754b; padding: 11px 13px; font-size: 13px; }.notice.error { background: #fff0ef; color: #a44242; }
	.state-box { text-align: center; padding: 48px 20px; }
	.state-box.error { border-color: #d69b9b; color: #a44242; }
	.insight-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .92fr) minmax(0, 1fr); gap: 18px; align-items: start; }
	.insight-column { display: grid; gap: 18px; align-content: start; }
	.insight-card { border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 22px; box-shadow: 0 8px 22px rgba(35, 71, 46, .05); }
	.paused-card { min-height: 220px; display: flex; flex-direction: column; justify-content: center; }
	.pause-mark { display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 18px; border-radius: 50%; background: #fff0dc; color: #875c22; font-size: 15px; font-weight: 800; }
	.paused-card h2 { margin: 0 0 8px; font-size: 19px; }
	.paused-card > p:last-child { margin: 0; color: #718077; font-size: 12px; line-height: 1.6; }
	.insight-switcher { padding: 12px 20px 20px; }
	.insight-tabs { display: flex; gap: 22px; margin: 0 -4px 20px; border-bottom: 1px solid #dfe8dd; }
	.insight-tabs button { position: relative; border: 0; background: transparent; color: #718077; padding: 12px 4px; font: 700 12px 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; }
	.insight-tabs button.active { color: #275f3a; }
	.insight-tabs button.active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 3px; background: #39754b; content: ''; }
	.insight-tabs button:focus-visible { outline: 2px solid #39754b; outline-offset: 2px; }
	.tab-panel { outline: none; }
	.insight-heading { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; border-bottom: 1px solid #e8eee6; padding-bottom: 16px; margin-bottom: 16px; }
	.insight-heading h2 { margin: 3px 0 0; font-size: 20px; }.source-note { color: #718077; font-size: 11px; text-align: right; }.source-logo { display: inline-flex; align-items: center; min-height: 27px; padding: 0 9px; border-radius: 5px; color: #fff; font: 800 12px Arial, sans-serif; letter-spacing: .06em; }.bmkg-logo { background: #1769aa; }.bps-logo { background: #1b4d8f; }.ai-logo { background: #39754b; }
	.weather-tabs { display: flex; gap: 6px; margin-bottom: 12px; }.weather-tabs button { border: 1px solid #d6e1d5; border-radius: 6px; background: #f7faf6; color: #52705a; padding: 8px 9px; cursor: pointer; font-size: 11px; }.weather-tabs button.active { background: #39754b; border-color: #39754b; color: #fff; }
	.weather-list { display: grid; gap: 9px; }.weather-row { display: grid; grid-template-columns: 1.2fr .8fr; gap: 7px 12px; padding: 11px; border: 1px solid #e5ede3; border-radius: 7px; background: #f9fbf8; }.weather-row strong, .weather-row span { display: block; }.weather-row strong { color: #274a32; font-size: 13px; }.weather-row span { color: #718077; font-size: 11px; margin-top: 4px; }.weather-main { text-align: right; }.weather-meta { grid-column: 1 / -1; display: flex; gap: 14px; border-top: 1px solid #e8eee6; padding-top: 7px; }
	.source-footer { margin-top: 16px; color: #829087; font-size: 10px; line-height: 1.5; }
	.ai-card h3 { margin: 0 0 10px; color: #274a32; font-size: 17px; }.ai-card p, .market-summary { color: #53665a; font-size: 13px; line-height: 1.65; }.ai-card ol { margin: 15px 0 0; padding-left: 20px; color: #385540; font-size: 13px; line-height: 1.55; }.ai-card li + li { margin-top: 8px; }.action-badge { border-radius: 999px; background: #edf8ed; color: #39754b; padding: 6px 9px; font: 700 10px Arial, sans-serif; }
	.market-stat { display: inline-flex; flex-direction: column; min-width: 43%; margin: 0 8px 14px 0; padding: 13px; border-radius: 7px; background: #f4f8f2; }.market-stat span { color: #718077; font-size: 11px; }.market-stat strong { color: #39754b; font-size: 20px; margin-top: 5px; }.market-highlight { margin-top: 15px; border-left: 3px solid #6eaa78; background: #f4faf2; color: #385540; padding: 12px 13px; font-size: 13px; line-height: 1.5; }.market-card footer { margin-top: 22px; padding-top: 13px; border-top: 1px solid #e8eee6; color: #829087; font-size: 10px; line-height: 1.5; }
	.refresh-button { margin-top: 12px; border: 1px solid #b7d0b6; border-radius: 6px; background: #f4faf2; color: #39754b; padding: 8px 10px; font-size: 11px; cursor: pointer; }
	@media (max-width: 1050px) { .insight-layout { grid-template-columns: 1fr 1fr; } .insight-layout > .insight-column:first-child { grid-row: span 2; } }
	@media (max-width: 700px) { .page-shell { padding: 24px 14px 48px; } .insight-layout { grid-template-columns: 1fr; } .insight-layout > .insight-column:first-child { grid-row: auto; } .detail-card, .insight-card { padding: 20px; } .facts-grid, .edit-grid { grid-template-columns: 1fr; } .edit-grid .wide { grid-column: auto; } .edit-intro { display: block; } .edit-intro > span { display: block; margin-top: 8px; text-align: left; } .weather-tabs { flex-wrap: wrap; } }
</style>
