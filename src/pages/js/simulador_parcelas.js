// renderer_simulador_parcelas.js

(function () {
  console.log(
    "[Simulador Parcelas] Script carregado. Iniciando configuração (dentro da IIFE)..."
  );

  const PORTO_LANCE_FIXO_PERCENTUAL = 0.4;
  const PORTO_EMBUTIDO_IMOVEL_PERCENTUAL = 0.3;
  const PORTO_AUTO_VALOR_CORTE_EMBUTIDO = 180000;

  const YAMAHA_LANCE_FIXO_IMOVEL_SALDO_DEVEDOR_PERCENTUAL = 0.3;
  const YAMAHA_LANCE_FIXO_IMOVEL_EMBUTIDO_AUXILIAR_CREDITO_PERCENTUAL = 0.25;
  const YAMAHA_LANCE_FIXO_AUTO_VAGA_EXCLUSIVA_SALDO_DEVEDOR_PERCENTUAL = 0.25;
  const YAMAHA_LANCE_FIXO_AUTO_VAGA_EXCLUSIVA_EMBUTIDO_AUXILIAR_CREDITO_PERCENTUAL = 0.15;
  const YAMAHA_EMBUTIDO_LIVRE_IMOVEL_CREDITO_PERCENTUAL = 0.25;
  const YAMAHA_EMBUTIDO_LIVRE_AUTO_CREDITO_PERCENTUAL = 0.15;

  let ultimoResultadoParaPdf = null;

  function formatarMoeda(valor) {
    if (typeof valor !== "number" || isNaN(valor)) return "R$ --";
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function handleCurrencyInput(event) {
    const input = event.target;
    let digitsOnly = input.value.replace(/\D/g, "");

    if (digitsOnly === "") {
      input.value = "";
      return;
    }

    // Converte os dígitos para um número, tratando como centavos
    const valueAsNumber = parseInt(digitsOnly, 10) / 100;

    // Formata o número de volta para o padrão de moeda do Brasil (ex: "R$ 120.000,00")
    input.value = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valueAsNumber);
  }
  function formatPercentFromDigits(digitsAndMaybeSeparator, precision = 2) {
    if (
      digitsAndMaybeSeparator === null ||
      typeof digitsAndMaybeSeparator === "undefined"
    )
      return ``;
    let [integerPart = "0", decimalPart = ""] = String(
      digitsAndMaybeSeparator
    ).split(",");
    if (integerPart.length > 1 && integerPart.startsWith("0")) {
      integerPart = integerPart.replace(/^0+/, "");
      if (integerPart.length === 0) integerPart = "0";
    }
    if (
      integerPart.length === 0 &&
      String(digitsAndMaybeSeparator).startsWith(",")
    )
      integerPart = "0";
    decimalPart = decimalPart.padEnd(precision, "0").substring(0, precision);
    return `${integerPart},${decimalPart}`;
  }
  function getNumericValue(value, dataType) {
    if (typeof value !== "string" || !value) return NaN;

    if (dataType === "currency") {
      // Pega apenas os dígitos do texto (ex: "R$ 120.000,00" -> "12000000")
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly === "") return NaN;

      // Converte para número e divide por 100 para ter o valor em reais (ex: 12000000 -> 120000.00)
      const numberValue = parseFloat(digitsOnly) / 100;
      return isNaN(numberValue) ? NaN : numberValue;
    } else if (dataType === "percent") {
      const cleanedValue = value.replace("%", "").replace(",", ".").trim();
      const num = parseFloat(cleanedValue);
      return isNaN(num) ? NaN : num;
    }

    // Fallback para outros tipos, caso existam
    const num = parseFloat(value);
    return isNaN(num) ? NaN : num;
  }

  function handlePercentInputEvent(event) {
    const input = event.target;
    let cursorPos = input.selectionStart;
    const originalValue = input.value;
    const precision = parseInt(input.dataset.precision, 10) || 2;
    let rawValue = input.value;
    let justDigitsAndSeparator = rawValue.replace(/[^\d,.]/g, "");
    const firstSeparatorIndex = justDigitsAndSeparator.search(/[,.]/);

    if (firstSeparatorIndex !== -1) {
      let integerPart = justDigitsAndSeparator.substring(
        0,
        firstSeparatorIndex
      );
      let decimalPart = justDigitsAndSeparator
        .substring(firstSeparatorIndex + 1)
        .replace(/[.,]/g, "");
      justDigitsAndSeparator =
        integerPart + "," + decimalPart.substring(0, precision);
    }
    input.value = justDigitsAndSeparator;
    let diff = input.value.length - originalValue.length;
    let newCursorPos = cursorPos + diff;
    if (
      originalValue.length > input.value.length &&
      originalValue[cursorPos - 1] === ","
    ) {
      newCursorPos = cursorPos - 1;
    } else if (cursorPos === originalValue.length && diff > 0) {
      newCursorPos = input.value.length;
    }
    try {
      if (input.value !== originalValue)
        input.setSelectionRange(newCursorPos, newCursorPos);
    } catch (e) {}
  }
  function handleFinalFormattingOnBlur(event) {
    const input = event.target;
    const dataType = input.dataset.type;
    let value = input.value;

    if (
      value.trim() === "" ||
      value.trim() === "R$" ||
      value.trim() === "," ||
      value.trim() === "%"
    ) {
      const isOptionalZeroField =
        input.id.includes("RedutorParcela") ||
        input.id.includes("Adesao") ||
        input.id.includes("FundoReserva") ||
        input.id.includes("SeguroVida") ||
        input.id.includes("Embutido");
      if (isOptionalZeroField) {
        if (dataType === "percent") {
          input.value =
            formatPercentFromDigits(
              "0",
              parseInt(input.dataset.precision, 10) || 2
            ) + "%";
        } else if (dataType === "currency" && input.id.includes("Embutido")) {
          input.value = formatarMoeda(0);
        } else input.value = "";
      } else {
        input.value = "";
      }
      return;
    }
    let numericValue = getNumericValue(value, dataType);
    if (isNaN(numericValue)) {
      const isOptionalZeroFieldOnError =
        input.id.includes("RedutorParcela") ||
        input.id.includes("Adesao") ||
        input.id.includes("FundoReserva") ||
        input.id.includes("SeguroVida") ||
        input.id.includes("Embutido");
      if (isOptionalZeroFieldOnError) {
        if (dataType === "percent")
          input.value =
            formatPercentFromDigits(
              "0",
              parseInt(input.dataset.precision, 10) || 2
            ) + "%";
        else if (dataType === "currency" && input.id.includes("Embutido"))
          input.value = formatarMoeda(0);
        else input.value = "";
      } else {
        input.value = "";
      }
      return;
    }
    const minAttr = input.getAttribute("min");
    if (minAttr && numericValue < parseFloat(minAttr)) {
      numericValue = parseFloat(minAttr);
    }
    const maxAttr = input.getAttribute("max");
    if (maxAttr && numericValue > parseFloat(maxAttr)) {
      numericValue = parseFloat(maxAttr);
    }
    if (dataType === "currency") {
      input.value = formatarMoeda(numericValue);
    } else if (dataType === "percent") {
      const precision = parseInt(input.dataset.precision, 10) || 2;
      input.value = numericValue.toFixed(precision).replace(".", ",") + "%";
    }
  }

  const opcaoLanceFixoItauImovelDiv = document.getElementById(
    "opcaoLanceFixoItauImovel"
  );
  const opcaoLanceLivreItauDiv = document.getElementById("opcaoLanceLivreItau");
  const opcaoLanceItauDiv = document.getElementById("opcaoLanceItau");
  const tipoLanceItauRadio = document.getElementById("tipoLanceItau");
  const camposLanceItauDiv = document.getElementById("camposLanceItau");
  const percentualLanceProprioItauInput = document.getElementById(
    "percentualLanceProprioItau"
  );
  const percentualLanceEmbutidoItauInput = document.getElementById(
    "percentualLanceEmbutidoItau"
  );
  const opcaoLanceFixoAutomovelYamahaDiv = document.getElementById(
    "opcaoLanceFixoAutomovelYamaha"
  );
  const tipoLanceFixoAutomovelYamahaRadio = document.getElementById(
    "tipoLanceFixoAutomovelYamaha"
  );
  const containerYamahaAutomovelOpcoesFixoDiv = document.getElementById(
    "containerYamahaAutomovelOpcoesFixo"
  );
  const yamahaAutomovelPercentualFixoSelect = document.getElementById(
    "yamahaAutomovelPercentualFixo"
  );
  const resultadoNomeClienteSpan = document.getElementById(
    "resultadoNomeCliente"
  );
  const containerAdesao = document.getElementById("containerAdesao");
  const footerValorParcelasAdesao = document.getElementById(
    "footerValorParcelasAdesao"
  );
  const footerSeguroDeVida = document.getElementById("footerSeguroDeVida");
  const resultadoCreditoContratadoSpan = document.getElementById(
    "resultadoCreditoContratado"
  );
  const containerCreditoLiquidoDiv = document.getElementById(
    "containerCreditoLiquido"
  );
  const containerParcelaComRedutorDiv = document.getElementById(
    "containerParcelaComRedutor"
  );
  const resultadoSeguroDeVidaSpan = document.getElementById(
    "resultadoSeguroDeVida"
  );
  const resultadoPercentualLanceSpan = document.getElementById(
    "resultadoPercentualLance"
  );
  const containerParcelasAdesaoDiv = document.getElementById(
    "containerParcelasAdesao"
  );
  const resultadoParcelasAdesaoSpan = document.getElementById(
    "resultadoParcelasAdesao"
  );
  const resultadoParcelasRestantesSpan = document.getElementById(
    "resultadoParcelasRestantes"
  );
  const adminRadios = document.querySelectorAll('input[name="administradora"]');
  const selecaoTipoBemDiv = document.getElementById("selecaoTipoBem");
  const tipoBemRadios = document.querySelectorAll('input[name="tipoBem"]');
  const dadosClienteTipoDiv = document.getElementById("dadosClienteTipo");
  const allAdminBemFieldsDivs = document.querySelectorAll(
    ".administradora-bem-fields"
  );
  const dadosLanceDiv = document.getElementById("dadosLance");
  const tituloDadosLanceH2 = document.getElementById("tituloDadosLance");
  const containerPortoPercentualEmbutido = document.getElementById(
    "containerPortoPercentualEmbutido"
  );
  const portoAutomovelPercentualEmbutido = document.getElementById(
    "portoAutomovelPercentualEmbutido"
  );
  const containerTipoLance = document.getElementById("containerTipoLance");
  const labelTipoLance = document.getElementById("labelTipoLance");
  const portoImovelValorCreditoInput = document.getElementById(
    "portoImovelValorCredito"
  );
  const portoAutomovelValorCreditoInput = document.getElementById(
    "portoAutomovelValorCredito"
  );
  const portoAutomovelAlertaLanceDiv = document.getElementById(
    "portoAutomovelAlertaLance"
  );
  const yamahaImovelValorCreditoInput = document.getElementById(
    "yamahaImovelValorCredito"
  );
  const yamahaAutomovelValorCreditoInput = document.getElementById(
    "yamahaAutomovelValorCredito"
  );
  const tipoLanceNenhumRadio = document.getElementById("tipoLanceNenhum");
  const opcaoLanceLivreGeralPortoDiv = document.getElementById(
    "opcaoLanceLivreGeralPorto"
  );
  const tipoLanceLivreRadio = document.getElementById("tipoLanceLivre");
  const opcaoLanceFixoImovelPortoDiv = document.getElementById(
    "opcaoLanceFixoImovelPorto"
  );
  const tipoLanceFixoPortoImovelRadio = document.getElementById(
    "tipoLanceFixoPortoImovel"
  );
  const opcaoLanceFixoAutomovelPortoDiv = document.getElementById(
    "opcaoLanceFixoAutomovelPorto"
  );
  const tipoLanceFixoPortoAutomovelRadio = document.getElementById(
    "tipoLanceFixoPortoAutomovel"
  );
  const camposLanceFixoPortoDiv = document.getElementById(
    "camposLanceFixoPorto"
  );
  const valorCalculadoLanceFixoPortoSpan = document.getElementById(
    "valorCalculadoLanceFixoPorto"
  );
  const valorEscondidoLanceFixoPortoInput = document.getElementById(
    "valorEscondidoLanceFixoPorto"
  );
  const usarEmbutidoLanceFixoPortoCheckbox = document.getElementById(
    "usarEmbutidoLanceFixoPorto"
  );
  const labelUsarEmbutidoLanceFixoPorto = document.getElementById(
    "labelUsarEmbutidoLanceFixoPorto"
  );
  const detalhesEmbutidoLanceFixoPortoDiv = document.getElementById(
    "detalhesEmbutidoLanceFixoPorto"
  );
  const maximoEmbutidoFixoPortoValorSpan = document.getElementById(
    "maximoEmbutidoFixoPortoValor"
  );
  const valorEmbutidoLanceFixoPortoUsarInput = document.getElementById(
    "valorEmbutidoLanceFixoPortoUsar"
  );
  const avisoMaxEmbutidoLanceFixoPortoSmall = document.getElementById(
    "avisoMaxEmbutidoLanceFixoPorto"
  );
  const camposLanceLivreDiv = document.getElementById("camposLanceLivre");
  const valorLanceLivreInput = document.getElementById("valorLanceLivre");
  const percentualLanceLivreInput = document.getElementById(
    "percentualLanceLivre"
  );
  const usarEmbutidoLanceLivreCheckbox = document.getElementById(
    "usarEmbutidoLanceLivre"
  );
  const labelUsarEmbutidoLanceLivre = document.getElementById(
    "labelUsarEmbutidoLanceLivre"
  );
  const detalhesEmbutidoLanceLivreDiv = document.getElementById(
    "detalhesEmbutidoLanceLivre"
  );
  const maximoEmbutidoLivreValorSpan = document.getElementById(
    "maximoEmbutidoLivreValor"
  );
  const valorEmbutidoLanceLivreUsarInput = document.getElementById(
    "valorEmbutidoLanceLivreUsar"
  );
  const avisoMaxEmbutidoLanceLivreSmall = document.getElementById(
    "avisoMaxEmbutidoLanceLivre"
  );
  const opcaoLanceLivreYamahaDiv = document.getElementById(
    "opcaoLanceLivreYamaha"
  );
  const tipoLanceLivreYamahaRadio = document.getElementById(
    "tipoLanceLivreYamaha"
  );
  const opcaoLanceFixoImovelYamahaDiv = document.getElementById(
    "opcaoLanceFixoImovelYamaha"
  );
  const tipoLanceFixoImovelYamahaRadio = document.getElementById(
    "tipoLanceFixoImovelYamaha"
  );
  const opcaoLanceFixoVagaExclusivaYamahaAutomovelDiv = document.getElementById(
    "opcaoLanceFixoVagaExclusivaYamahaAutomovel"
  );
  const tipoLanceFixoVagaExclusivaYamahaAutomovelRadio =
    document.getElementById("tipoLanceFixoVagaExclusivaYamahaAutomovel");
  const camposLanceLivreYamahaDiv = document.getElementById(
    "camposLanceLivreYamaha"
  );
  const valorLanceLivreYamahaInput = document.getElementById(
    "valorLanceLivreYamaha"
  );
  const percentualLanceLivreYamahaInput = document.getElementById(
    "percentualLanceLivreYamaha"
  );
  const usarEmbutidoLanceLivreYamahaCheckbox = document.getElementById(
    "usarEmbutidoLanceLivreYamaha"
  );
  const labelUsarEmbutidoLanceLivreYamaha = document.getElementById(
    "labelUsarEmbutidoLanceLivreYamaha"
  );
  const detalhesEmbutidoLanceLivreYamahaDiv = document.getElementById(
    "detalhesEmbutidoLanceLivreYamaha"
  );
  const maximoEmbutidoLivreYamahaValorSpan = document.getElementById(
    "maximoEmbutidoLivreYamahaValor"
  );
  const valorEmbutidoLanceLivreYamahaUsarInput = document.getElementById(
    "valorEmbutidoLanceLivreYamahaUsar"
  );
  const avisoMaxEmbutidoLanceLivreYamahaSmall = document.getElementById(
    "avisoMaxEmbutidoLanceLivreYamaha"
  );
  const camposLanceFixoImovelYamahaDiv = document.getElementById(
    "camposLanceFixoImovelYamaha"
  );
  const valorCalculadoLanceFixoImovelYamahaSpan = document.getElementById(
    "valorCalculadoLanceFixoImovelYamaha"
  );
  const valorEscondidoLanceFixoImovelYamahaInput = document.getElementById(
    "valorEscondidoLanceFixoImovelYamaha"
  );
  const usarEmbutidoFixoImovelYamahaCheckbox = document.getElementById(
    "usarEmbutidoFixoImovelYamaha"
  );
  const labelUsarEmbutidoFixoImovelYamaha = document.getElementById(
    "labelUsarEmbutidoFixoImovelYamaha"
  );
  const detalhesEmbutidoFixoImovelYamahaDiv = document.getElementById(
    "detalhesEmbutidoFixoImovelYamaha"
  );
  const maximoEmbutidoFixoImovelYamahaValorSpan = document.getElementById(
    "maximoEmbutidoFixoImovelYamahaValor"
  );
  const valorEmbutidoFixoImovelYamahaUsarInput = document.getElementById(
    "valorEmbutidoFixoImovelYamahaUsar"
  );
  const avisoMaxEmbutidoFixoImovelYamahaSmall = document.getElementById(
    "avisoMaxEmbutidoFixoImovelYamaha"
  );
  const camposLanceFixoVagaExclusivaYamahaAutomovelDiv =
    document.getElementById("camposLanceFixoVagaExclusivaYamahaAutomovel");
  const valorCalculadoLanceFixoVagaExclusivaYamahaAutomovelSpan =
    document.getElementById(
      "valorCalculadoLanceFixoVagaExclusivaYamahaAutomovel"
    );
  const valorEscondidoLanceFixoVagaExclusivaYamahaAutomovelInput =
    document.getElementById(
      "valorEscondidoLanceFixoVagaExclusivaYamahaAutomovel"
    );
  const usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox =
    document.getElementById("usarEmbutidoFixoVagaExclusivaYamahaAutomovel");
  const labelUsarEmbutidoFixoVagaExclusivaYamahaAutomovel =
    document.getElementById(
      "labelUsarEmbutidoFixoVagaExclusivaYamahaAutomovel"
    );
  const detalhesEmbutidoFixoVagaExclusivaYamahaAutomovelDiv =
    document.getElementById("detalhesEmbutidoFixoVagaExclusivaYamahaAutomovel");
  const maximoEmbutidoFixoVagaExclusivaYamahaAutomovelValorSpan =
    document.getElementById(
      "maximoEmbutidoFixoVagaExclusivaYamahaAutomovelValor"
    );
  const valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput =
    document.getElementById(
      "valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsar"
    );
  const avisoMaxEmbutidoFixoVagaExclusivaYamahaAutomovelSmall =
    document.getElementById("avisoMaxEmbutidoFixoVagaExclusivaYamahaAutomovel");
  const formaAbatimentoLanceContainerDiv = document.getElementById(
    "formaAbatimentoLanceContainer"
  );
  const formaAbatimentoLanceSelect = document.getElementById(
    "formaAbatimentoLance"
  );
  const mesesPagosAntesDoLanceInput = document.getElementById(
    "mesesPagosAntesDoLance"
  );
  const btnSimular = document.getElementById("btnSimular");
  const erroSimulacaoP = document.getElementById("erroSimulacao");
  const areaResultadosSimulacaoDiv = document.getElementById(
    "areaResultadosSimulacao"
  );
  const nomeAdminResultadoSpan = document.getElementById("nomeAdminResultado");
  const tipoBemResultadoSpan = document.getElementById("tipoBemResultado");
  const resultadoTipoClienteSpan = document.getElementById(
    "resultadoTipoCliente"
  );
  const resultadoParcelaPuraSpan = document.getElementById(
    "resultadoParcelaPura"
  );
  const resultadoTaxaAdmMensalSpan = document.getElementById(
    "resultadoTaxaAdmMensal"
  );
  const resultadoValorTaxaAdmMensalSpan = document.getElementById(
    "resultadoValorTaxaAdmMensal"
  );
  const resultadoFundoReservaMensalSpan = document.getElementById(
    "resultadoFundoReservaMensal"
  );
  const resultadoValorFundoReservaMensalSpan = document.getElementById(
    "resultadoValorFundoReservaMensal"
  );
  const resultadoInfoAdesaoSpan = document.getElementById(
    "resultadoInfoAdesao"
  );
  const resultadoSeguroVidaMensalSpan = document.getElementById(
    "resultadoSeguroVidaMensal"
  );
  const labelParcelaBaseSemRedutorStrong = document.getElementById(
    "labelParcelaBaseSemRedutor"
  );
  const resultadoParcelaBaseSemRedutorSpan = document.getElementById(
    "resultadoParcelaBaseSemRedutor"
  );
  const infoRedutorAplicadoDiv = document.getElementById("infoRedutorAplicado");
  const resultadoPercentualRedutorSpan = document.getElementById(
    "resultadoPercentualRedutor"
  );
  const labelParcelaComRedutorStrong = document.getElementById(
    "labelParcelaComRedutor"
  );
  const resultadoParcelaComRedutorSpan = document.getElementById(
    "resultadoParcelaComRedutor"
  );
  const resultadosComLanceDiv = document.getElementById("resultadosComLance");
  const resultadoTipoLanceOfertadoSpan = document.getElementById(
    "resultadoTipoLanceOfertado"
  );
  const resultadoValorLanceOfertadoSpan = document.getElementById(
    "resultadoValorLanceOfertado"
  );
  const resultadoValorEmbutidoUtilizadoSpan = document.getElementById(
    "resultadoValorEmbutidoUtilizado"
  );
  const resultadoValorLanceDoBolsoSpan = document.getElementById(
    "resultadoValorLanceDoBolso"
  );
  const resultadoCreditoLiquidoSpan = document.getElementById(
    "resultadoCreditoLiquido"
  );
  const resultadoPrazoComLanceSpan = document.getElementById(
    "resultadoPrazoComLance"
  );
  const resultadoParcelaPosContemplacaoSpan = document.getElementById(
    "resultadoParcelaPosContemplacao"
  );
  const resultadoSaldoDevedorBaseOriginalSpan = document.getElementById(
    "resultadoSaldoDevedorBaseOriginal"
  );
  const resultadoSaldoDevedorAtualizadoPreLanceSpan = document.getElementById(
    "resultadoSaldoDevedorAtualizadoPreLance"
  );
  const resultadoSeguroVidaMensalAtualizadoPreLanceSpan =
    document.getElementById("resultadoSeguroVidaMensalAtualizadoPreLance");
  const resultadoNumParcelasPagasAbatimentoSpan = document.getElementById(
    "resultadoNumParcelasPagasAbatimento"
  );
  const btnImprimirPDF = document.getElementById("btnImprimirPDF");

  const setElementVisibility = (element, visible) => {
    if (element) {
      element.style.display = visible ? "block" : "none";
    }
  };
  const setRadioOptionAndContainerVisibility = (
    radioInput,
    containerDiv,
    visible
  ) => {
    if (containerDiv) {
      setElementVisibility(containerDiv, visible);
    } else if (radioInput) {
      const label = document.querySelector(`label[for="${radioInput.id}"]`);
      setElementVisibility(radioInput, visible);
      setElementVisibility(label, visible);
      let br = label
        ? label.nextElementSibling
        : radioInput
        ? radioInput.nextElementSibling
        : null;
      if (br && br.tagName === "BR") setElementVisibility(br, visible);
    }
  };

  document
    .querySelectorAll('input[data-type="currency"], input[data-type="percent"]')
    .forEach((input) => {
      if (input) {
        const type = input.dataset.type;
        if (type === "currency")
          input.addEventListener("input", handleCurrencyInput);
        else if (type === "percent")
          input.addEventListener("input", handlePercentInputEvent);
        input.addEventListener("blur", handleFinalFormattingOnBlur);
      }
    });

  document
    .querySelectorAll(
      'input[type="number"][id$="NumeroParcelas"], #mesesPagosAntesDoLance'
    )
    .forEach((input) => {
      if (input) {
        input.addEventListener("input", (e) => {
          let value = e.target.value.replace(/\D/g, "");
          const maxLength = 3;
          if (value.length > maxLength) value = value.slice(0, maxLength);
          e.target.value = value;
        });
        input.addEventListener("blur", (e) => {
          let value = parseInt(e.target.value, 10);
          const minVal = e.target.id === "mesesPagosAntesDoLance" ? 0 : 1;
          let maxVal = e.target.id === "mesesPagosAntesDoLance" ? 239 : 999;

          const adminEl = document.querySelector(
            'input[name="administradora"]:checked'
          );
          const tipoBemEl = document.querySelector(
            'input[name="tipoBem"]:checked'
          );

          if (e.target.id.endsWith("NumeroParcelas")) {
            maxVal = 999;
          } else if (
            e.target.id === "mesesPagosAntesDoLance" &&
            adminEl &&
            tipoBemEl
          ) {
            const admin = adminEl.value;
            const tipoBem = tipoBemEl.value;
            const currentPrefix = `${admin}${
              tipoBem.charAt(0).toUpperCase() + tipoBem.slice(1)
            }`;
            const prazoConsorcioEl = document.getElementById(
              `${currentPrefix}NumeroParcelas`
            );
            if (prazoConsorcioEl && prazoConsorcioEl.value) {
              const prazoTotalNum = parseInt(prazoConsorcioEl.value, 10);
              if (!isNaN(prazoTotalNum) && prazoTotalNum > 0) {
                maxVal = prazoTotalNum;
              }
            }
          }
          if (isNaN(value) || value < minVal) e.target.value = String(minVal);
          else if (value > maxVal) e.target.value = String(maxVal);
        });
      }
    });

  function configurarInterfaceLance(
    admin,
    tipoBem,
    preservarSelecaoLance = false
  ) {
    if (!dadosLanceDiv) return;

    if (containerPortoPercentualEmbutido)
      containerPortoPercentualEmbutido.style.display = "none";
    if (containerYamahaAutomovelOpcoesFixo)
      containerYamahaAutomovelOpcoesFixo.style.display = "none";

    if (tituloDadosLanceH2) {
      tituloDadosLanceH2.textContent = `Simulação com Lance (Opcional)`;
    }
    if (labelTipoLance) {
      labelTipoLance.textContent = `Tipo de Lance (${
        admin.charAt(0).toUpperCase() + admin.slice(1)
      }):`;
    }

    setRadioOptionAndContainerVisibility(
      null,
      opcaoLanceLivreGeralPortoDiv,
      false
    );
    setRadioOptionAndContainerVisibility(
      null,
      opcaoLanceFixoImovelPortoDiv,
      false
    );
    setRadioOptionAndContainerVisibility(
      null,
      opcaoLanceFixoAutomovelPortoDiv,
      false
    );
    setRadioOptionAndContainerVisibility(null, opcaoLanceLivreYamahaDiv, false);
    setRadioOptionAndContainerVisibility(
      null,
      opcaoLanceFixoImovelYamahaDiv,
      false
    );
    setRadioOptionAndContainerVisibility(
      null,
      opcaoLanceFixoAutomovelYamahaDiv,
      false
    );
    setRadioOptionAndContainerVisibility(null, opcaoLanceItauDiv, false);

    if (!preservarSelecaoLance && tipoLanceNenhumRadio) {
      tipoLanceNenhumRadio.checked = true;
    }

    let valorCredito = 0;
    const valorCreditoElId = `${admin}${
      tipoBem.charAt(0).toUpperCase() + tipoBem.slice(1)
    }ValorCredito`;
    const valorCreditoInput = document.getElementById(valorCreditoElId);
    if (valorCreditoInput) {
      valorCredito = getNumericValue(valorCreditoInput.value, "currency") || 0;
    }

    dadosLanceDiv.style.display = "block";

    if (admin === "porto") {
      setRadioOptionAndContainerVisibility(
        null,
        opcaoLanceLivreGeralPortoDiv,
        true
      );
      if (containerPortoPercentualEmbutido) {
        containerPortoPercentualEmbutido.style.display =
          tipoBem === "automovel" ? "block" : "none";
      }
      if (tipoBem === "imovel") {
        setRadioOptionAndContainerVisibility(
          null,
          opcaoLanceFixoImovelPortoDiv,
          true
        );
      } else if (tipoBem === "automovel") {
        const mostrarFixoPortoAuto = valorCredito >= 180000;
        setRadioOptionAndContainerVisibility(
          null,
          opcaoLanceFixoAutomovelPortoDiv,
          mostrarFixoPortoAuto
        );
      }
      atualizarAvisosMaxEmbutido(admin, tipoBem, valorCredito);
    } else if (admin === "yamaha") {
      setRadioOptionAndContainerVisibility(
        null,
        opcaoLanceLivreYamahaDiv,
        true
      );
      if (tipoBem === "imovel") {
        setRadioOptionAndContainerVisibility(
          null,
          opcaoLanceFixoImovelYamahaDiv,
          true
        );
      } else if (tipoBem === "automovel") {
        setRadioOptionAndContainerVisibility(
          null,
          opcaoLanceFixoAutomovelYamahaDiv,
          true
        );
      }
      atualizarAvisosMaxEmbutido(admin, tipoBem, valorCredito);
    } else if (admin === "itau") {
      setRadioOptionAndContainerVisibility(null, opcaoLanceItauDiv, true);
    }

    atualizarVisibilidadeCamposLanceDetalhes();
  }

  function ocultarTodasSecoesPrincipais() {
    setElementVisibility(selecaoTipoBemDiv, false);
    setElementVisibility(dadosClienteTipoDiv, false);
    allAdminBemFieldsDivs.forEach((div) => setElementVisibility(div, false));
    setElementVisibility(dadosLanceDiv, false);
    setElementVisibility(camposLanceLivreDiv, false);
    setElementVisibility(camposLanceFixoPortoDiv, false);
    setElementVisibility(camposLanceLivreYamahaDiv, false);
    setElementVisibility(camposLanceFixoImovelYamahaDiv, false);
    setElementVisibility(camposLanceFixoVagaExclusivaYamahaAutomovelDiv, false);
    setElementVisibility(formaAbatimentoLanceContainerDiv, false);
    setElementVisibility(areaResultadosSimulacaoDiv, false);
    setElementVisibility(erroSimulacaoP, false);
    setElementVisibility(portoAutomovelAlertaLanceDiv, false);
  }

  function atualizarVisibilidadeCamposAdmin() {
    ocultarTodasSecoesPrincipais();
    const adminSelecionadaEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    if (adminSelecionadaEl) {
      setElementVisibility(selecaoTipoBemDiv, true);
      tipoBemRadios.forEach((radio) => (radio.checked = false));
    } else {
      setElementVisibility(selecaoTipoBemDiv, false);
    }
  }

  function atualizarVisibilidadeCamposBem() {
    const adminSelecionadaEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    const tipoBemSelecionadoEl = document.querySelector(
      'input[name="tipoBem"]:checked'
    );

    allAdminBemFieldsDivs.forEach((div) => setElementVisibility(div, false));
    setElementVisibility(dadosClienteTipoDiv, false);
    setElementVisibility(dadosLanceDiv, false);
    setElementVisibility(portoAutomovelAlertaLanceDiv, false);
    setElementVisibility(areaResultadosSimulacaoDiv, false);
    setElementVisibility(erroSimulacaoP, false);

    if (adminSelecionadaEl && tipoBemSelecionadoEl) {
      const admin = adminSelecionadaEl.value;
      const tipoBem = tipoBemSelecionadoEl.value;
      const idDivToShow = `fields${
        admin.charAt(0).toUpperCase() + admin.slice(1)
      }${tipoBem.charAt(0).toUpperCase() + tipoBem.slice(1)}`;
      const divParaMostrar = document.getElementById(idDivToShow);

      if (divParaMostrar) {
        setElementVisibility(divParaMostrar, true);
        setElementVisibility(dadosClienteTipoDiv, true);

        if (admin === "porto" || admin === "yamaha" || admin === "itau") {
          setElementVisibility(dadosLanceDiv, true);
          configurarInterfaceLance(admin, tipoBem, false);
        } else {
          setElementVisibility(dadosLanceDiv, false);
        }
      }
      if (nomeAdminResultadoSpan)
        nomeAdminResultadoSpan.textContent = admin.toUpperCase();
      if (tipoBemResultadoSpan)
        tipoBemResultadoSpan.textContent = tipoBem.toUpperCase();
    }
  }

  function calcularValoresBaseParaLanceJS() {
    const adminEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    const tipoBemEl = document.querySelector('input[name="tipoBem"]:checked');
    if (!adminEl || !tipoBemEl)
      return {
        saldoDevedorBaseOriginalJS: 0,
        saldoDevedorVigenteJS: 0,
        parcelaComRedutorJS: 0,
        valorSeguroVidaMensalOriginalJS: 0,
        seguroVidaMensalVigenteJS: 0,
        prazoRestanteVigenteJS: 0,
        parcelaOriginalJS: 0,
        numParcelasPagasParaAbatimentoJS: 0,
      };

    const admin = adminEl.value;
    const tipoBem = tipoBemEl.value;
    const currentPrefix = `${admin}${
      tipoBem.charAt(0).toUpperCase() + tipoBem.slice(1)
    }`;

    const valorCreditoEl = document.getElementById(
      `${currentPrefix}ValorCredito`
    );
    const prazoEl = document.getElementById(`${currentPrefix}NumeroParcelas`);
    const taxaAdmEl = document.getElementById(`${currentPrefix}TaxaAdm`);
    const fundoReservaEl = document.getElementById(
      `${currentPrefix}FundoReserva`
    );
    const seguroVidaEl = document.getElementById(`${currentPrefix}SeguroVida`);
    const redutorEl = document.getElementById(`${currentPrefix}RedutorParcela`);
    const mesesPagosAntesEl = document.getElementById("mesesPagosAntesDoLance");
    const tipoClienteEl = document.querySelector(
      'input[name="tipoCliente"]:checked'
    );

    const valorCreditoOriginal =
      getNumericValue(valorCreditoEl?.value, "currency") || 0;
    const prazoTotalConsorcio = parseInt(prazoEl?.value, 10) || 0;
    const taxaAdmTotalPercent =
      getNumericValue(taxaAdmEl?.value, "percent") || 0;
    const fundoReservaTotalPercent =
      getNumericValue(fundoReservaEl?.value, "percent") || 0;
    const seguroVidaMensalInformadoPercent =
      getNumericValue(seguroVidaEl?.value, "percent") || 0;
    const percentualRedutorAplicado =
      getNumericValue(redutorEl?.value, "percent") || 0;
    const mesesPagosAntesLanceEstimativa =
      parseInt(mesesPagosAntesEl?.value, 10) || 0;
    const tipoCliente = tipoClienteEl ? tipoClienteEl.value : "cpf";

    if (valorCreditoOriginal <= 0 || prazoTotalConsorcio <= 0) {
      return {
        saldoDevedorBaseOriginalJS: 0,
        saldoDevedorVigenteJS: 0,
        parcelaComRedutorJS: 0,
        valorSeguroVidaMensalOriginalJS: 0,
        seguroVidaMensalVigenteJS: 0,
        prazoRestanteVigenteJS: prazoTotalConsorcio,
        parcelaOriginalJS: 0,
        numParcelasPagasParaAbatimentoJS: 0,
      };
    }

    const percTaxaAdmTotalDecimal = taxaAdmTotalPercent / 100.0;
    const valorTotalTaxaAdm = valorCreditoOriginal * percTaxaAdmTotalDecimal;
    const valorTaxaAdmMensal = valorTotalTaxaAdm / prazoTotalConsorcio;

    const percFundoReservaTotalDecimal = fundoReservaTotalPercent / 100.0;
    const valorTotalFundoReserva =
      valorCreditoOriginal * percFundoReservaTotalDecimal;
    const valorFundoReservaMensal =
      valorTotalFundoReserva / prazoTotalConsorcio;

    const parcelaPura = valorCreditoOriginal / prazoTotalConsorcio;
    const saldoDevedorBaseOriginalJS =
      valorCreditoOriginal + valorTotalTaxaAdm + valorTotalFundoReserva;

    let valorSeguroVidaMensalOriginalJS = 0;
    const percSeguroMensalInformadoDecimal =
      seguroVidaMensalInformadoPercent / 100.0;
    if (tipoCliente === "cpf" && percSeguroMensalInformadoDecimal > 0) {
      let baseCalculoSeguroInicial = valorCreditoOriginal;
      if (admin === "porto" || admin === "yamaha") {
        baseCalculoSeguroInicial = saldoDevedorBaseOriginalJS;
      }
      valorSeguroVidaMensalOriginalJS =
        baseCalculoSeguroInicial * percSeguroMensalInformadoDecimal;
    }

    const parcelaBaseAntesRedutorESeguro =
      parcelaPura + valorTaxaAdmMensal + valorFundoReservaMensal;
    const parcelaOriginalJS =
      parcelaBaseAntesRedutorESeguro + valorSeguroVidaMensalOriginalJS;

    let parcelaComRedutorJS = parcelaOriginalJS;
    if (percentualRedutorAplicado > 0) {
      const componenteBaseComRedutor =
        parcelaBaseAntesRedutorESeguro *
        (1.0 - percentualRedutorAplicado / 100.0);
      parcelaComRedutorJS =
        componenteBaseComRedutor + valorSeguroVidaMensalOriginalJS;
    }
    if (parcelaComRedutorJS < 0) parcelaComRedutorJS = 0;

    let numParcelasPagasParaAbatimentoJS = 0;
    if (
      mesesPagosAntesLanceEstimativa > 0 &&
      mesesPagosAntesLanceEstimativa < prazoTotalConsorcio
    ) {
      numParcelasPagasParaAbatimentoJS = mesesPagosAntesLanceEstimativa;
    }

    let saldoDevedorVigenteJS = saldoDevedorBaseOriginalJS;
    let prazoRestanteVigenteJS = prazoTotalConsorcio;
    let seguroVidaMensalVigenteJS = valorSeguroVidaMensalOriginalJS;

    if (numParcelasPagasParaAbatimentoJS > 0) {
      const totalJaPagoAbatidoDoSDB =
        parcelaComRedutorJS * numParcelasPagasParaAbatimentoJS;
      saldoDevedorVigenteJS =
        saldoDevedorBaseOriginalJS - totalJaPagoAbatidoDoSDB;
      prazoRestanteVigenteJS =
        prazoTotalConsorcio - numParcelasPagasParaAbatimentoJS;

      if (tipoCliente === "cpf" && percSeguroMensalInformadoDecimal > 0) {
        let baseCalculoSeguroAtualizado = valorCreditoOriginal;
        if (admin === "porto" || admin === "yamaha") {
          baseCalculoSeguroAtualizado = saldoDevedorVigenteJS;
        }
        seguroVidaMensalVigenteJS =
          baseCalculoSeguroAtualizado * percSeguroMensalInformadoDecimal;
      } else {
        seguroVidaMensalVigenteJS = 0.0;
      }
    }

    prazoRestanteVigenteJS = Math.max(1, prazoRestanteVigenteJS);
    saldoDevedorVigenteJS = Math.max(0, saldoDevedorVigenteJS);

    return {
      saldoDevedorBaseOriginalJS,
      saldoDevedorVigenteJS,
      parcelaComRedutorJS,
      valorSeguroVidaMensalOriginalJS,
      seguroVidaMensalVigenteJS,
      prazoRestanteVigenteJS,
      parcelaOriginalJS,
      numParcelasPagasParaAbatimentoJS,
    };
  }

  function atualizarCalculoLanceFixoPortoDisplay() {
    const { saldoDevedorVigenteJS } = calcularValoresBaseParaLanceJS();
    const valorLanceFixoCalculado =
      saldoDevedorVigenteJS * PORTO_LANCE_FIXO_PERCENTUAL;

    if (valorCalculadoLanceFixoPortoSpan) {
      valorCalculadoLanceFixoPortoSpan.textContent = formatarMoeda(
        valorLanceFixoCalculado
      );
    }
    if (valorEscondidoLanceFixoPortoInput) {
      valorEscondidoLanceFixoPortoInput.value =
        valorLanceFixoCalculado.toFixed(2);
    }
  }

  function atualizarCalculoLanceFixoYamahaImovelDisplay() {
    const { saldoDevedorVigenteJS } = calcularValoresBaseParaLanceJS();
    const valorLanceFixoCalculado =
      saldoDevedorVigenteJS * YAMAHA_LANCE_FIXO_IMOVEL_SALDO_DEVEDOR_PERCENTUAL;

    if (valorCalculadoLanceFixoImovelYamahaSpan) {
      valorCalculadoLanceFixoImovelYamahaSpan.textContent = formatarMoeda(
        valorLanceFixoCalculado
      );
    }
    if (valorEscondidoLanceFixoImovelYamahaInput) {
      valorEscondidoLanceFixoImovelYamahaInput.value =
        valorLanceFixoCalculado.toFixed(2);
    }
  }

  function atualizarCalculoLanceFixoYamahaAutomovelDisplay() {
    const { saldoDevedorVigenteJS } = calcularValoresBaseParaLanceJS();
    const valorLanceFixoCalculado =
      saldoDevedorVigenteJS *
      YAMAHA_LANCE_FIXO_AUTO_VAGA_EXCLUSIVA_SALDO_DEVEDOR_PERCENTUAL;

    if (valorCalculadoLanceFixoVagaExclusivaYamahaAutomovelSpan) {
      valorCalculadoLanceFixoVagaExclusivaYamahaAutomovelSpan.textContent =
        formatarMoeda(valorLanceFixoCalculado);
    }
    if (valorEscondidoLanceFixoVagaExclusivaYamahaAutomovelInput) {
      valorEscondidoLanceFixoVagaExclusivaYamahaAutomovelInput.value =
        valorLanceFixoCalculado.toFixed(2);
    }
  }

  function atualizarVisibilidadeCamposLanceDetalhes() {
    const tipoLanceSelecionadoEl = document.querySelector(
      'input[name="tipoLance"]:checked'
    );
    if (!tipoLanceSelecionadoEl) {
      setElementVisibility(formaAbatimentoLanceContainerDiv, false);
      return;
    }
    const tipoLance = tipoLanceSelecionadoEl.value;

    const adminEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    const admin = adminEl ? adminEl.value : null;

    setElementVisibility(camposLanceLivreDiv, false);
    setElementVisibility(camposLanceFixoPortoDiv, false);
    setElementVisibility(camposLanceLivreYamahaDiv, false);
    setElementVisibility(camposLanceFixoImovelYamahaDiv, false);
    setElementVisibility(camposLanceFixoVagaExclusivaYamahaAutomovelDiv, false);
    setElementVisibility(containerYamahaAutomovelOpcoesFixoDiv, false);
    setElementVisibility(camposLanceItauDiv, false);
    setElementVisibility(formaAbatimentoLanceContainerDiv, false);
    setElementVisibility(portoAutomovelAlertaLanceDiv, false);

    if (tipoLance === "nenhum") {
      return;
    }

    setElementVisibility(formaAbatimentoLanceContainerDiv, true);

    if (admin === "porto") {
      if (tipoLance === "livre") {
        setElementVisibility(camposLanceLivreDiv, true);
      } else if (
        tipoLance === "fixo_porto_imovel" ||
        tipoLance === "fixo_porto_automovel"
      ) {
        setElementVisibility(camposLanceFixoPortoDiv, true);
        atualizarCalculoLanceFixoPortoDisplay();
      }
    } else if (admin === "yamaha") {
      if (tipoLance === "livre_yamaha") {
        setElementVisibility(camposLanceLivreYamahaDiv, true);
      } else if (tipoLance === "fixo_yamaha_imovel") {
        setElementVisibility(camposLanceFixoImovelYamahaDiv, true);
        atualizarCalculoLanceFixoYamahaImovelDisplay();
      } else if (tipoLance === "fixo_yamaha_automovel") {
        setElementVisibility(containerYamahaAutomovelOpcoesFixoDiv, true);
        setElementVisibility(
          camposLanceFixoVagaExclusivaYamahaAutomovelDiv,
          true
        );
        atualizarCalculoLanceFixoYamahaAutomovelDisplay();
      }
    } else if (admin === "itau") {
      if (tipoLance === "lance_itau") {
        setElementVisibility(camposLanceItauDiv, true);
      }
    }

    toggleDetalhesEmbutido();
  }

  const valorCreditoInputs = [
    portoImovelValorCreditoInput,
    portoAutomovelValorCreditoInput,
    yamahaImovelValorCreditoInput,
    yamahaAutomovelValorCreditoInput,
  ];

  valorCreditoInputs.forEach((input) => {
    if (input) {
      const inputId = input.id.toLowerCase();
      let adminDoInput = null;
      let tipoBemDoInput = null;

      if (inputId.includes("porto")) adminDoInput = "porto";
      else if (inputId.includes("yamaha")) adminDoInput = "yamaha";

      if (inputId.includes("imovel")) tipoBemDoInput = "imovel";
      else if (inputId.includes("automovel")) tipoBemDoInput = "automovel";

      if (adminDoInput && tipoBemDoInput) {
        const eventHandler = (preservar) => {
          const adminSelecionadaEl = document.querySelector(
            'input[name="administradora"]:checked'
          );
          if (adminSelecionadaEl && adminSelecionadaEl.value === adminDoInput) {
            configurarInterfaceLance(adminDoInput, tipoBemDoInput, preservar);
          }
        };
        input.addEventListener("blur", () => eventHandler(false));
      }
    }
  });

  if (mesesPagosAntesDoLanceInput) {
    mesesPagosAntesDoLanceInput.addEventListener("input", () => {
      const adminEl = document.querySelector(
        'input[name="administradora"]:checked'
      );
      const tipoBemEl = document.querySelector('input[name="tipoBem"]:checked');
      if (adminEl && tipoBemEl) {
        configurarInterfaceLance(adminEl.value, tipoBemEl.value, true);
      }
    });
  }

  function atualizarAvisosMaxEmbutido(admin, tipoBem, valorCredito) {
    let maxEmbutidoPercent = 0;
    let spanMaxEmbutidoLivre = null;
    let inputValorEmbutidoLivre = null;
    let avisoMaxEmbutidoLivre = null;
    let labelEmbutidoLivre = null;

    let spanMaxEmbutidoFixo = null;
    let inputValorEmbutidoFixo = null;
    let avisoMaxEmbutidoFixo = null;
    let labelEmbutidoFixo = null;
    let maxEmbutidoFixoPercent = 0;

    if (admin === "porto") {
      spanMaxEmbutidoLivre = maximoEmbutidoLivreValorSpan;
      inputValorEmbutidoLivre = valorEmbutidoLanceLivreUsarInput;
      avisoMaxEmbutidoLivre = avisoMaxEmbutidoLanceLivreSmall;
      labelEmbutidoLivre = labelUsarEmbutidoLanceLivre;

      spanMaxEmbutidoFixo = maximoEmbutidoFixoPortoValorSpan;
      inputValorEmbutidoFixo = valorEmbutidoLanceFixoPortoUsarInput;
      avisoMaxEmbutidoFixo = avisoMaxEmbutidoLanceFixoPortoSmall;
      labelEmbutidoFixo = labelUsarEmbutidoLanceFixoPorto;

      if (tipoBem === "imovel") {
        maxEmbutidoPercent = PORTO_EMBUTIDO_IMOVEL_PERCENTUAL;
        maxEmbutidoFixoPercent = PORTO_EMBUTIDO_IMOVEL_PERCENTUAL;
      } else if (tipoBem === "automovel") {
        const percentualSelecionado =
          parseFloat(portoAutomovelPercentualEmbutido.value) || 0;
        maxEmbutidoPercent = percentualSelecionado;

        if (valorCredito >= PORTO_AUTO_VALOR_CORTE_EMBUTIDO) {
          maxEmbutidoFixoPercent = percentualSelecionado;
        } else {
          maxEmbutidoFixoPercent = 0;
        }
      }
    } else if (admin === "yamaha") {
      if (tipoBem === "imovel") {
        spanMaxEmbutidoLivre = maximoEmbutidoLivreYamahaValorSpan;
        inputValorEmbutidoLivre = valorEmbutidoLanceLivreYamahaUsarInput;
        avisoMaxEmbutidoLivre = avisoMaxEmbutidoLanceLivreYamahaSmall;
        labelEmbutidoLivre = labelUsarEmbutidoLanceLivreYamaha;
        maxEmbutidoPercent = YAMAHA_EMBUTIDO_LIVRE_IMOVEL_CREDITO_PERCENTUAL;

        spanMaxEmbutidoFixo = maximoEmbutidoFixoImovelYamahaValorSpan;
        inputValorEmbutidoFixo = valorEmbutidoFixoImovelYamahaUsarInput;
        avisoMaxEmbutidoFixo = avisoMaxEmbutidoFixoImovelYamahaSmall;
        labelEmbutidoFixo = labelUsarEmbutidoFixoImovelYamaha;
        maxEmbutidoFixoPercent =
          YAMAHA_LANCE_FIXO_IMOVEL_EMBUTIDO_AUXILIAR_CREDITO_PERCENTUAL;
      } else if (tipoBem === "automovel") {
        spanMaxEmbutidoLivre = maximoEmbutidoLivreYamahaValorSpan;
        inputValorEmbutidoLivre = valorEmbutidoLanceLivreYamahaUsarInput;
        avisoMaxEmbutidoLivre = avisoMaxEmbutidoLanceLivreYamahaSmall;
        labelEmbutidoLivre = labelUsarEmbutidoLanceLivreYamaha;
        maxEmbutidoPercent = YAMAHA_EMBUTIDO_LIVRE_AUTO_CREDITO_PERCENTUAL;

        spanMaxEmbutidoFixo =
          maximoEmbutidoFixoVagaExclusivaYamahaAutomovelValorSpan;
        inputValorEmbutidoFixo =
          valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput;
        avisoMaxEmbutidoFixo =
          avisoMaxEmbutidoFixoVagaExclusivaYamahaAutomovelSmall;
        labelEmbutidoFixo = labelUsarEmbutidoFixoVagaExclusivaYamahaAutomovel;
        maxEmbutidoFixoPercent =
          YAMAHA_LANCE_FIXO_AUTO_VAGA_EXCLUSIVA_EMBUTIDO_AUXILIAR_CREDITO_PERCENTUAL;
      }
    }

    const valorMaxEmbutidoAbsoluto = valorCredito * maxEmbutidoPercent;
    if (spanMaxEmbutidoLivre)
      spanMaxEmbutidoLivre.textContent = formatarMoeda(
        valorMaxEmbutidoAbsoluto
      );
    if (inputValorEmbutidoLivre)
      inputValorEmbutidoLivre.dataset.maxEmbutido =
        valorMaxEmbutidoAbsoluto.toFixed(2);
    if (avisoMaxEmbutidoLivre)
      avisoMaxEmbutidoLivre.textContent = `Máx. ${formatarMoeda(
        valorMaxEmbutidoAbsoluto
      )} (${(maxEmbutidoPercent * 100).toFixed(0)}% do crédito)`;
    if (labelEmbutidoLivre)
      labelEmbutidoLivre.textContent = `Utilizar Lance Embutido (${
        admin.charAt(0).toUpperCase() + admin.slice(1)
      } - até ${(maxEmbutidoPercent * 100).toFixed(0)}% do crédito)`;

    const valorMaxEmbutidoFixoAbsoluto = valorCredito * maxEmbutidoFixoPercent;
    if (spanMaxEmbutidoFixo) {
      spanMaxEmbutidoFixo.textContent = formatarMoeda(
        valorMaxEmbutidoFixoAbsoluto
      );
    }
    if (inputValorEmbutidoFixo) {
      inputValorEmbutidoFixo.dataset.maxEmbutido =
        valorMaxEmbutidoFixoAbsoluto.toFixed(2);
    }
    if (avisoMaxEmbutidoFixo) {
      avisoMaxEmbutidoFixo.textContent = `Máx. ${formatarMoeda(
        valorMaxEmbutidoFixoAbsoluto
      )} (${(maxEmbutidoFixoPercent * 100).toFixed(0)}% do crédito)`;
    }
    if (labelEmbutidoFixo) {
      let textoLabelFixo = `Utilizar Lance Embutido`;
      if (admin === "yamaha" && tipoBem === "imovel")
        textoLabelFixo = `Utilizar Lance Embutido Auxiliar (Yamaha Imóvel - até ${(
          maxEmbutidoFixoPercent * 100
        ).toFixed(0)}% do crédito)`;
      else if (admin === "yamaha" && tipoBem === "automovel")
        textoLabelFixo = `Utilizar Lance Embutido Auxiliar (Yamaha Automóvel - até ${(
          maxEmbutidoFixoPercent * 100
        ).toFixed(0)}% do crédito)`;
      else if (admin === "porto")
        textoLabelFixo = `Utilizar Lance Embutido (Porto - até ${(
          maxEmbutidoFixoPercent * 100
        ).toFixed(0)}% do crédito)`;
      labelEmbutidoFixo.textContent = textoLabelFixo;
    }
  }

  function toggleDetalhesEmbutido() {
    if (
      usarEmbutidoLanceFixoPortoCheckbox &&
      detalhesEmbutidoLanceFixoPortoDiv
    ) {
      detalhesEmbutidoLanceFixoPortoDiv.style.display =
        usarEmbutidoLanceFixoPortoCheckbox.checked ? "block" : "none";
      if (
        !usarEmbutidoLanceFixoPortoCheckbox.checked &&
        valorEmbutidoLanceFixoPortoUsarInput
      )
        valorEmbutidoLanceFixoPortoUsarInput.value = "";
    }
    if (usarEmbutidoLanceLivreCheckbox && detalhesEmbutidoLanceLivreDiv) {
      detalhesEmbutidoLanceLivreDiv.style.display =
        usarEmbutidoLanceLivreCheckbox.checked ? "block" : "none";
      if (
        !usarEmbutidoLanceLivreCheckbox.checked &&
        valorEmbutidoLanceLivreUsarInput
      )
        valorEmbutidoLanceLivreUsarInput.value = "";
    }
    if (
      usarEmbutidoLanceLivreYamahaCheckbox &&
      detalhesEmbutidoLanceLivreYamahaDiv
    ) {
      detalhesEmbutidoLanceLivreYamahaDiv.style.display =
        usarEmbutidoLanceLivreYamahaCheckbox.checked ? "block" : "none";
      if (
        !usarEmbutidoLanceLivreYamahaCheckbox.checked &&
        valorEmbutidoLanceLivreYamahaUsarInput
      )
        valorEmbutidoLanceLivreYamahaUsarInput.value = "";
    }
    if (
      usarEmbutidoFixoImovelYamahaCheckbox &&
      detalhesEmbutidoFixoImovelYamahaDiv
    ) {
      detalhesEmbutidoFixoImovelYamahaDiv.style.display =
        usarEmbutidoFixoImovelYamahaCheckbox.checked ? "block" : "none";
      if (
        !usarEmbutidoFixoImovelYamahaCheckbox.checked &&
        valorEmbutidoFixoImovelYamahaUsarInput
      )
        valorEmbutidoFixoImovelYamahaUsarInput.value = "";
    }
    if (
      usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox &&
      detalhesEmbutidoFixoVagaExclusivaYamahaAutomovelDiv
    ) {
      detalhesEmbutidoFixoVagaExclusivaYamahaAutomovelDiv.style.display =
        usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox.checked
          ? "block"
          : "none";
      if (
        !usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox.checked &&
        valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput
      )
        valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput.value = "";
    }
  }

  [
    usarEmbutidoLanceFixoPortoCheckbox,
    usarEmbutidoLanceLivreCheckbox,
    usarEmbutidoLanceLivreYamahaCheckbox,
    usarEmbutidoFixoImovelYamahaCheckbox,
    usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox,
  ].forEach((checkbox) => {
    if (checkbox) checkbox.addEventListener("change", toggleDetalhesEmbutido);
  });

  [
    valorEmbutidoLanceFixoPortoUsarInput,
    valorEmbutidoLanceLivreUsarInput,
    valorEmbutidoLanceLivreYamahaUsarInput,
    valorEmbutidoFixoImovelYamahaUsarInput,
    valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput,
  ].forEach((input) => {
    if (input) {
      input.addEventListener("blur", (event) => {
        const targetInput = event.target;
        const valorDigitado = getNumericValue(targetInput.value, "currency");
        const maxEmbutidoPermitido = parseFloat(
          targetInput.dataset.maxEmbutido
        );

        if (!isNaN(valorDigitado) && !isNaN(maxEmbutidoPermitido)) {
          if (valorDigitado > maxEmbutidoPermitido) {
            targetInput.value = formatarMoeda(maxEmbutidoPermitido);
          }
        } else if (isNaN(valorDigitado)) {
          targetInput.value = formatarMoeda(0);
        }
      });
    }
  });

  function getDadosCreditoFromForm() {
    const adminEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    const tipoBemEl = document.querySelector('input[name="tipoBem"]:checked');
    const tipoClienteEl = document.querySelector(
      'input[name="tipoCliente"]:checked'
    );

    if (!adminEl || !tipoBemEl || !tipoClienteEl) {
      console.error(
        "[Simulador Parcelas] Erro: Administradora, Tipo de Bem ou Opção de Seguro não selecionado."
      );
      return null;
    }
    const admin = adminEl.value;
    const tipoBem = tipoBemEl.value;
    const tipoCliente = tipoClienteEl.value; // 'cpf' é "Com Seguro", 'cnpj' é "Sem Seguro"
    const prefix = `${admin}${
      tipoBem.charAt(0).toUpperCase() + tipoBem.slice(1)
    }`;

    let seguroVidaPercent = 0;
    if (tipoCliente === "cpf") {
      seguroVidaPercent = getNumericValue(
        document.getElementById(`${prefix}SeguroVida`)?.value,
        "percent"
      );
    }

    const dadosCredito = {
      nomeCliente:
        document.getElementById("nomeCliente")?.value || "Não informado",
      admin: admin,
      tipoBem: tipoBem,
      tipoCliente: tipoCliente,
      valorCredito: getNumericValue(
        document.getElementById(`${prefix}ValorCredito`)?.value,
        "currency"
      ),
      numeroParcelas: parseInt(
        document.getElementById(`${prefix}NumeroParcelas`)?.value,
        10
      ),
      taxaAdm: getNumericValue(
        document.getElementById(`${prefix}TaxaAdm`)?.value,
        "percent"
      ),
      fundoReserva: getNumericValue(
        document.getElementById(`${prefix}FundoReserva`)?.value,
        "percent"
      ),
      seguroVida: seguroVidaPercent, // Usamos a variável que acabamos de calcular
      redutorParcela: getNumericValue(
        document.getElementById(`${prefix}RedutorParcela`)?.value,
        "percent"
      ),
      adesao:
        admin === "porto" && tipoBem === "imovel"
          ? getNumericValue(
              document.getElementById(`portoImovelAdesao`)?.value,
              "percent"
            )
          : 0,
      formaPagamentoAdesao:
        admin === "porto" && tipoBem === "imovel"
          ? document.querySelector(
              'input[name="portoImovelPagamentoAdesao"]:checked'
            )?.value
          : null,
      mesesPagosAntesLance:
        parseInt(mesesPagosAntesDoLanceInput?.value, 10) || 0,
      portoAutomovelPercentualEmbutido:
        admin === "porto" && tipoBem === "automovel"
          ? parseFloat(portoAutomovelPercentualEmbutido?.value)
          : null,
    };

    if (
      isNaN(dadosCredito.valorCredito) ||
      dadosCredito.valorCredito <= 0 ||
      isNaN(dadosCredito.numeroParcelas) ||
      dadosCredito.numeroParcelas <= 0
    ) {
      console.error(
        "[Simulador Parcelas] Erro: Valor do crédito ou número de parcelas inválido."
      );
      if (erroSimulacaoP) {
        erroSimulacaoP.textContent =
          "Erro: Valor do crédito e Número de Parcelas são obrigatórios e devem ser maiores que zero.";
        setElementVisibility(erroSimulacaoP, true);
      }
      return null;
    }
    return dadosCredito;
  }

  function getDadosLanceFromForm() {
    const adminEl = document.querySelector(
      'input[name="administradora"]:checked'
    );
    const tipoBemEl = document.querySelector('input[name="tipoBem"]:checked');
    const tipoLanceEl = document.querySelector(
      'input[name="tipoLance"]:checked'
    );

    if (
      !adminEl ||
      !tipoBemEl ||
      !tipoLanceEl ||
      tipoLanceEl.value === "nenhum"
    ) {
      return { tipo: "nenhum" }; // Retorna um objeto indicando que não há lance
    }

    const admin = adminEl.value;
    const tipoLance = tipoLanceEl.value;
    const formaAbatimento = formaAbatimentoLanceSelect
      ? formaAbatimentoLanceSelect.value
      : "reduzir_prazo_final";

    let dadosLance = {
      tipo: tipoLance,
      formaAbatimento: formaAbatimento,
      valorLanceLivre: 0,
      percentualLanceLivre: 0,
      usarEmbutido: false,
      valorEmbutido: 0,
      percentualLanceProprioItau: 0,
      percentualLanceEmbutidoItau: 0,
    };

    if (admin === "itau") {
      if (tipoLance === "lance_itau") {
        dadosLance.percentualLanceProprioItau =
          getNumericValue(percentualLanceProprioItauInput?.value, "percent") ||
          0;
        dadosLance.percentualLanceEmbutidoItau =
          getNumericValue(percentualLanceEmbutidoItauInput?.value, "percent") ||
          0;
      }
    } else if (admin === "porto") {
      // A lógica para Porto Seguro permanece a mesma que você já tinha
      if (tipoLance === "livre") {
        dadosLance.valorLanceLivre =
          getNumericValue(valorLanceLivreInput?.value, "currency") || 0;
        dadosLance.percentualLanceLivre =
          getNumericValue(percentualLanceLivreInput?.value, "percent") || 0;
        dadosLance.usarEmbutido =
          usarEmbutidoLanceLivreCheckbox?.checked || false;
        if (dadosLance.usarEmbutido) {
          dadosLance.valorEmbutido =
            getNumericValue(
              valorEmbutidoLanceLivreUsarInput?.value,
              "currency"
            ) || 0;
        }
      } else if (
        tipoLance === "fixo_porto_imovel" ||
        tipoLance === "fixo_porto_automovel"
      ) {
        dadosLance.usarEmbutido =
          usarEmbutidoLanceFixoPortoCheckbox?.checked || false;
        if (dadosLance.usarEmbutido) {
          dadosLance.valorEmbutido =
            getNumericValue(
              valorEmbutidoLanceFixoPortoUsarInput?.value,
              "currency"
            ) || 0;
        }
      }
    } else if (admin === "yamaha") {
      if (tipoLance === "livre_yamaha") {
        dadosLance.valorLanceLivre =
          getNumericValue(valorLanceLivreYamahaInput?.value, "currency") || 0;
        dadosLance.percentualLanceLivre =
          getNumericValue(percentualLanceLivreYamahaInput?.value, "percent") ||
          0;
        dadosLance.usarEmbutido =
          usarEmbutidoLanceLivreYamahaCheckbox?.checked || false;
        if (dadosLance.usarEmbutido) {
          dadosLance.valorEmbutido =
            getNumericValue(
              valorEmbutidoLanceLivreYamahaUsarInput?.value,
              "currency"
            ) || 0;
        }
      } else if (tipoLance === "fixo_yamaha_imovel") {
        dadosLance.usarEmbutido =
          usarEmbutidoFixoImovelYamahaCheckbox?.checked || false;
        if (dadosLance.usarEmbutido) {
          dadosLance.valorEmbutido =
            getNumericValue(
              valorEmbutidoFixoImovelYamahaUsarInput?.value,
              "currency"
            ) || 0;
        }
      } else if (tipoLance === "fixo_yamaha_automovel") {
        dadosLance.usarEmbutido =
          usarEmbutidoFixoVagaExclusivaYamahaAutomovelCheckbox?.checked ||
          false;
        if (dadosLance.usarEmbutido) {
          dadosLance.valorEmbutido =
            getNumericValue(
              valorEmbutidoFixoVagaExclusivaYamahaAutomovelUsarInput?.value,
              "currency"
            ) || 0;
        }
        dadosLance.percentualLanceFixoYamahaAuto =
          parseFloat(yamahaAutomovelPercentualFixoSelect?.value) || 0;
      }
    }

    return dadosLance;
  }

  async function simularConsorcio() {
    if (erroSimulacaoP) erroSimulacaoP.textContent = "";
    setElementVisibility(areaResultadosSimulacaoDiv, false);

    const dadosCredito = getDadosCreditoFromForm();
    if (!dadosCredito) {
      if (btnSimular) {
        btnSimular.disabled = false;
        btnSimulacaoP.textContent = "Calcular Simulação Completa";
      }
      return;
    }

    const dadosLance = getDadosLanceFromForm();
    const payload = {
      credito: dadosCredito,
      lance: dadosLance,
    };

    if (btnSimular) {
      btnSimular.disabled = true;
      btnSimular.textContent = "Simulando...";
    }

    if (typeof window.electronAPI?.invoke !== "function") {
      console.error(
        "[Simulador Parcelas] Erro: electronAPI.invoke não está definida."
      );
      if (erroSimulacaoP) {
        erroSimulacaoP.textContent =
          "Erro de configuração: Comunicação com backend indisponível.";
        setElementVisibility(erroSimulacaoP, true);
      }
      if (btnSimular) {
        btnSimular.disabled = false;
        btnSimular.textContent = "Calcular Simulação Completa";
      }
      return;
    }

    try {
      const resultado = await window.electronAPI.invoke(
        "calcular-simulacao",
        payload
      );

      if (resultado.erro) {
        if (erroSimulacaoP) {
          erroSimulacaoP.textContent = `Erro na simulação: ${resultado.erro}`;
          if (resultado.traceback)
            console.error("Traceback do Erro:", resultado.traceback);
        }
        setElementVisibility(erroSimulacaoP, true);
      } else {
        exibirResultados(resultado, dadosCredito);
        setElementVisibility(areaResultadosSimulacaoDiv, true);
        if (btnImprimirPDF) setElementVisibility(btnImprimirPDF, true);
      }
    } catch (error) {
      console.error(
        "[Simulador Parcelas] Erro ao chamar o backend via IPC:",
        error
      );
      if (erroSimulacaoP)
        erroSimulacaoP.textContent = `Erro ao comunicar com o backend: ${
          error.message || String(error)
        }`;
      setElementVisibility(erroSimulacaoP, true);
    } finally {
      if (btnSimular) {
        btnSimular.disabled = false;
        btnSimular.textContent = "Calcular Simulação Completa";
      }
    }
  }
  async function exibirResultados(data, dadosCredito) {
    const {
      lance,
      parcelaComRedutor,
      parcelaOriginal,
      creditoLiquido,
      parcelaPosContemplacao,
      prazoComLance,
      adesaoMensal,
      percentualRedutor,
    } = data;

    const { admin, tipoBem, valorCredito, nomeCliente } = dadosCredito;

    const userDataResponse = await window.electronAPI.invoke(
      "get-current-user-data"
    );
    const nomeUsuarioLogado = userDataResponse.success
      ? userDataResponse.user.username
      : "N/A";

    // Preenche os spans principais
    if (resultadoNomeCliente) {
      resultadoNomeCliente.textContent = nomeCliente || "Não informado";
    }
    if (nomeAdminResultado) {
      nomeAdminResultado.textContent = admin ? admin.toUpperCase() : "--";
    }
    if (tipoBemResultado) {
      tipoBemResultado.textContent = tipoBem ? tipoBem.toUpperCase() : "--";
    }
    if (resultadoCreditoContratado) {
      resultadoCreditoContratado.textContent = formatarMoeda(valorCredito);
    }

    // --- MUDANÇA 1: Aplica o risco na Parcela Integral na tela ---
    if (resultadoParcelaBaseSemRedutor) {
      resultadoParcelaBaseSemRedutor.innerHTML = `<s>${formatarMoeda(
        parcelaOriginal
      )}</s>`;
    }

    const comLance = lance && lance.tipo !== "nenhum";

    // --- MUDANÇA 2: Aplica o estilo verde condicionalmente na tela ---
    const parcelaComRedutorEl = document.getElementById(
      "resultadoParcelaComRedutor"
    );
    if (parcelaComRedutorEl) {
      parcelaComRedutorEl.textContent = formatarMoeda(parcelaComRedutor);
      if (!comLance) {
        // Se NÃO tiver lance, aplica o estilo de destaque
        parcelaComRedutorEl.style.color = "rgb(136, 201, 38)";
        parcelaComRedutorEl.style.fontSize = "1.25em";
        parcelaComRedutorEl.style.fontWeight = "700";
      } else {
        // Se TIVER lance, volta ao estilo padrão do CSS
        parcelaComRedutorEl.style.color = "";
        parcelaComRedutorEl.style.fontSize = "";
        parcelaComRedutorEl.style.fontWeight = "";
      }
    }

    const comRedutorAplicado = percentualRedutor > 0;
    setElementVisibility(
      document.getElementById("containerParcelaComRedutor"),
      comRedutorAplicado
    );
    if (comRedutorAplicado) {
      if (resultadoPercentualRedutor) {
        resultadoPercentualRedutor.textContent = `${(percentualRedutor || 0)
          .toFixed(2)
          .replace(".", ",")}`;
      }
    }

    setElementVisibility(
      document.getElementById("resultadosComLance"),
      comLance
    );
    setElementVisibility(
      document.getElementById("resultadosComLance_novaParcela"),
      comLance
    );
    setElementVisibility(
      document.getElementById("containerCreditoLiquido"),
      comLance
    );

    if (comLance) {
      if (resultadoCreditoLiquido) {
        resultadoCreditoLiquido.textContent = formatarMoeda(creditoLiquido);
      }
      if (resultadoTipoLanceOfertado) {
        resultadoTipoLanceOfertado.textContent = (lance.tipo || "N/A")
          .replace(/_/g, " ")
          .toUpperCase();
      }
      if (resultadoPercentualLance) {
        resultadoPercentualLance.textContent = `${(
          lance.percentualOfertado || 0
        )
          .toFixed(2)
          .replace(".", ",")}%`;
      }
      if (resultadoValorEmbutidoUtilizado) {
        resultadoValorEmbutidoUtilizado.textContent = formatarMoeda(
          lance.valorEmbutido
        );
      }
      if (resultadoValorLanceDoBolso) {
        resultadoValorLanceDoBolso.textContent = formatarMoeda(
          lance.valorDoBolso
        );
      }
      if (resultadoParcelaPosContemplacao) {
        resultadoParcelaPosContemplacao.textContent = formatarMoeda(
          parcelaPosContemplacao
        );
      }
    }

    if (resultadoPrazoComLance) {
      resultadoPrazoComLance.textContent = `${prazoComLance} meses`;
    }

    const comAdesao = admin === "porto" && adesaoMensal > 0;
    setElementVisibility(
      document.getElementById("blocoResultadoAdesao"),
      comAdesao
    );
    if (comAdesao) {
      if (labelResultadoAdesao) {
        labelResultadoAdesao.textContent = `Adesão (${dadosCredito.adesao}% / ${dadosCredito.formaPagamentoAdesao}x)`;
      }
      if (valorResultadoAdesao) {
        valorResultadoAdesao.textContent = `${
          dadosCredito.formaPagamentoAdesao
        }x primeiras parcelas de ${formatarMoeda(
          parcelaComRedutor + adesaoMensal
        )}`;
      }
    }

    const resultadoGeradoPorSpan =
      document.getElementById("resultadoGeradoPor");
    const resultadoDataSimulacaoSpan = document.getElementById(
      "resultadoDataSimulacao"
    );

    if (resultadoGeradoPorSpan) {
      resultadoGeradoPorSpan.textContent = `Gerado Por: ${nomeUsuarioLogado}`;
    }
    if (resultadoDataSimulacaoSpan) {
      resultadoDataSimulacaoSpan.textContent = `Data da Simulação: ${new Date().toLocaleDateString(
        "pt-BR"
      )}`;
    }

    ultimoResultadoParaPdf = { resultado: data, dadosCredito: dadosCredito };
    setElementVisibility(areaResultadosSimulacao, true);
  }

  adminRadios.forEach((radio) =>
    radio.addEventListener("change", atualizarVisibilidadeCamposAdmin)
  );
  tipoBemRadios.forEach((radio) =>
    radio.addEventListener("change", atualizarVisibilidadeCamposBem)
  );

  if (portoAutomovelPercentualEmbutido) {
    portoAutomovelPercentualEmbutido.addEventListener("change", () => {
      const adminEl = document.querySelector(
        'input[name="administradora"]:checked'
      );
      const tipoBemEl = document.querySelector('input[name="tipoBem"]:checked');
      const valorCreditoInput = document.getElementById(
        "portoAutomovelValorCredito"
      );

      if (
        adminEl &&
        adminEl.value === "porto" &&
        tipoBemEl &&
        tipoBemEl.value === "automovel" &&
        valorCreditoInput
      ) {
        const valorCredito =
          getNumericValue(valorCreditoInput.value, "currency") || 0;
        atualizarAvisosMaxEmbutido("porto", "automovel", valorCredito);
      }
    });
  }

  document.querySelectorAll('input[name="tipoLance"]').forEach((radio) => {
    radio.addEventListener("change", atualizarVisibilidadeCamposLanceDetalhes);
  });

  if (btnSimular) {
    btnSimular.addEventListener("click", simularConsorcio);
  }

  if (btnImprimirPDF) {
    btnImprimirPDF.addEventListener("click", async () => {
      if (!ultimoResultadoParaPdf) {
        erroSimulacaoP.textContent =
          "Por favor, gere uma simulação primeiro antes de imprimir.";
        setElementVisibility(erroSimulacaoP, true);
        return;
      }

      btnImprimirPDF.disabled = true;
      btnImprimirPDF.textContent = "Gerando PDF...";
      erroSimulacaoP.style.display = "none";

      try {
        const { resultado, dadosCredito } = ultimoResultadoParaPdf;

        // --- ESTA É A VALIDAÇÃO PRINCIPAL ---
        const comLance = resultado.lance && resultado.lance.tipo !== "nenhum";
        const estiloBlocoLance = comLance ? "" : "display: none;";
        // --- FIM DA VALIDAÇÃO ---

        const userDataResponse = await window.electronAPI.invoke(
          "get-current-user-data"
        );
        const nomeUsuarioLogado = userDataResponse.success
          ? userDataResponse.user.username
          : "N/A";

        const newLocal_1 = {
          NOME_CLIENTE: dadosCredito.nomeCliente.toUpperCase() || "N/A",
          ADMIN_NOME: dadosCredito.admin.toUpperCase() || "N/A",
          TIPO_BEM: dadosCredito.tipoBem.toUpperCase() || "N/A",
          NOME_USUARIO: nomeUsuarioLogado,
          DATA_SIMULACAO: new Date().toLocaleDateString("pt-BR"),
          VALOR_CREDITO: formatarMoeda(dadosCredito.valorCredito),
          PERC_REDUTOR: (resultado.percentualRedutor || 0)
            .toFixed(2)
            .replace(".", ","),
          PARCELA_COM_REDUTOR: formatarMoeda(resultado.parcelaComRedutor),

          // --- MUDANÇA 1: Adicionando o risco na parcela integral ---
          PARCELA_INTEGRAL: `<s>${formatarMoeda(
            resultado.parcelaOriginal
          )}</s>`,

          PRAZO_RESTANTE: `${
            comLance ? resultado.prazoComLance : dadosCredito.numeroParcelas
          } Meses`,
          TEM_ADESAO:
            dadosCredito.admin === "porto" && resultado.adesaoMensal > 0,
          QTD_PARCELAS_ADESAO: dadosCredito.formaPagamentoAdesao || 0,
          VALOR_PARCELA_ADESAO: formatarMoeda(
            resultado.parcelaComRedutor + resultado.adesaoMensal
          ),

          // --- MUDANÇA 2: Criando o novo estilo condicional ---
          ESTILO_DESTAQUE_SEM_LANCE: !comLance
            ? "color: rgb(136, 201, 38); font-size: 1.2em;"
            : "",

          // --- Propriedades de Lance (continuam iguais) ---
          LANCE_INFO_STYLE: estiloBlocoLance,
          CREDITO_LIQUIDO: comLance
            ? formatarMoeda(resultado.creditoLiquido)
            : "",
          NOVA_PARCELA: comLance
            ? formatarMoeda(resultado.parcelaPosContemplacao)
            : "",
          TIPO_LANCE: comLance
            ? (resultado.lance.tipo || "N/A").replace(/_/g, " ").toUpperCase()
            : "",
          PERC_LANCE: comLance
            ? (resultado.lance.percentualOfertado || 0)
                .toFixed(2)
                .replace(".", ",") + "%"
            : "",
          LANCE_EMBUTIDO: comLance
            ? formatarMoeda(resultado.lance.valorEmbutido)
            : "",
          RECURSO_PROPRIO: comLance
            ? formatarMoeda(resultado.lance.valorDoBolso)
            : "",
        };
        const newLocal = newLocal_1;
        const dadosParaTemplate = newLocal;

        const resultadoPdf = await window.electronAPI.invoke(
          "gerar-pdf-com-template",
          dadosParaTemplate
        );

        if (!resultadoPdf.success && !resultadoPdf.cancelled) {
          throw new Error(resultadoPdf.message);
        }
      } catch (err) {
        console.error("Erro no processo de gerar PDF:", err);
        erroSimulacaoP.textContent = `Erro ao gerar PDF: ${err.message}`;
        setElementVisibility(erroSimulacaoP, true);
      } finally {
        btnImprimirPDF.disabled = false;
        btnImprimirPDF.textContent = "Imprimir Simulação em PDF";
      }
    });
  }

  ocultarTodasSecoesPrincipais();
  const adminSelecionadaInicialEl = document.querySelector(
    'input[name="administradora"]:checked'
  );
  if (adminSelecionadaInicialEl) {
    atualizarVisibilidadeCamposAdmin();
    const tipoBemSelecionadoInicialEl = document.querySelector(
      'input[name="tipoBem"]:checked'
    );
    if (tipoBemSelecionadoInicialEl) {
      atualizarVisibilidadeCamposBem();
    }
  }
  toggleDetalhesEmbutido();

  console.log(
    "[Simulador Parcelas] Configuração inicial e listeners de evento configurados."
  );
})();
