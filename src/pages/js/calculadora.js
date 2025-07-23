/**
 * @param {object} dadosCredito
 * @param {object} dadosLanceInput
 * @returns {object}
 */
function realizarCalculoSimulacao(dadosCredito, dadosLanceInput) {
  try {
    const PORTO_LANCE_FIXO_PERCENTUAL = 0.4;
    const PORTO_EMBUTIDO_IMOVEL_PERCENTUAL = 0.3;
    const YAMAHA_LANCE_FIXO_IMOVEL_SALDO_DEVEDOR_PERCENTUAL = 0.3;
    const YAMAHA_EMBUTIDO_LIVRE_IMOVEL_CREDITO_PERCENTUAL = 0.25;
    const YAMAHA_EMBUTIDO_LIVRE_AUTO_CREDITO_PERCENTUAL = 0.15;
    const ITAU_EMBUTIDO_MAX_PERCENTUAL = 0.3;

    const {
      admin,
      tipoBem,
      tipoCliente,
      valorCredito: valorCreditoStr = "0",
      numeroParcelas: numeroParcelasStr = "0",
      taxaAdm: taxaAdmStr = "0",
      fundoReserva: fundoReservaStr = "0",
      seguroVida: seguroVidaStr = "0",
      redutorParcela: redutorParcelaStr = "0",
      adesao: adesaoStr = "0",
      formaPagamentoAdesao,
      mesesPagosAntesLance: mesesPagosAntesLanceStr = "0",
      portoAutomovelPercentualEmbutido: portoAutoPercEmbutidoInput = 0,
    } = dadosCredito;

    const valorCreditoOriginal = parseFloat(valorCreditoStr) || 0;
    const prazoTotalConsorcio = parseInt(numeroParcelasStr, 10) || 0;
    const taxaAdmTotalPercent = parseFloat(taxaAdmStr) || 0;
    const fundoReservaTotalPercent = parseFloat(fundoReservaStr) || 0;
    const seguroVidaMensalInformadoPercent = parseFloat(seguroVidaStr) || 0;
    const percentualRedutorAplicado = parseFloat(redutorParcelaStr) || 0;
    const percentualAdesaoInput = parseFloat(adesaoStr) || 0;
    const mesesPagosAntesLance = parseInt(mesesPagosAntesLanceStr, 10) || 0;

    if (valorCreditoOriginal <= 0 || prazoTotalConsorcio <= 0) {
      return {
        erro: "Valor do crédito e/ou Número de Parcelas são inválidos.",
      };
    }

    // --- 2. CÁLCULO DOS VALORES INICIAIS ---
    const taxaAdmTotalValor =
      valorCreditoOriginal * (taxaAdmTotalPercent / 100.0);
    const fundoReservaTotalValor =
      valorCreditoOriginal * (fundoReservaTotalPercent / 100.0);
    const saldoDevedorOriginal =
      valorCreditoOriginal + taxaAdmTotalValor + fundoReservaTotalValor;

    let seguroVidaMensalFixo = 0.0;
    if (tipoCliente === "cpf" && seguroVidaMensalInformadoPercent > 0) {
      const baseCalculoSeguro = ["porto", "yamaha"].includes(admin)
        ? saldoDevedorOriginal
        : valorCreditoOriginal;
      seguroVidaMensalFixo =
        baseCalculoSeguro * (seguroVidaMensalInformadoPercent / 100.0);
    }

    let adesaoMensal = 0.0;
    let numeroParcelasAdesao = 0;
    let mesesRestantesAdesao = 0;
    if (
      admin === "porto" &&
      tipoBem === "imovel" &&
      percentualAdesaoInput > 0
    ) {
      const valorTotalAdesao =
        valorCreditoOriginal * (percentualAdesaoInput / 100.0);
      numeroParcelasAdesao = parseInt(formaPagamentoAdesao, 10) || 1;
      if (numeroParcelasAdesao > 0) {
        adesaoMensal = valorTotalAdesao / numeroParcelasAdesao;
      }
    }

    // --- 3. CÁLCULO DAS PARCELAS INICIAIS ---
    const parcelaBaseSemSeguro =
      prazoTotalConsorcio > 0 ? saldoDevedorOriginal / prazoTotalConsorcio : 0;
    const parcelaComRedutorSemSeguro =
      parcelaBaseSemSeguro * (1.0 - percentualRedutorAplicado / 100.0);
    const parcelaOriginalCompleta = parcelaBaseSemSeguro + seguroVidaMensalFixo;
    const parcelaComRedutorCompleta =
      parcelaComRedutorSemSeguro + seguroVidaMensalFixo;

    // --- 4. SIMULAÇÃO DE PAGAMENTOS PRÉ-LANCE ---
    const saldoDevedorVigente =
      saldoDevedorOriginal - parcelaComRedutorSemSeguro * mesesPagosAntesLance;
    const prazoRestanteVigente = prazoTotalConsorcio - mesesPagosAntesLance;
    if (numeroParcelasAdesao > 0) {
      mesesRestantesAdesao = Math.max(
        0,
        numeroParcelasAdesao - mesesPagosAntesLance
      );
    }

    // --- 5. CÁLCULO DO LANCE ---
    const lanceCalculadoObj = {
      tipo: dadosLanceInput.tipo || "nenhum",
      valorCalculado: 0.0,
      percentualOfertado: 0.0,
      valorEmbutido: 0.0,
      valorDoBolso: 0.0,
      formaAbatimento: dadosLanceInput.formaAbatimento,
    };
    const tipoLanceSelecionado = dadosLanceInput.tipo;

    if (tipoLanceSelecionado !== "nenhum") {
      let parteEmbutidaReais = 0;
      let partePropriaReais = 0;
      const baseCalculoLance =
        admin === "itau" ? valorCreditoOriginal : saldoDevedorVigente;

      if (admin === "porto") {
        if (dadosLanceInput.usarEmbutido) {
          const maxEmbutidoPerc =
            tipoBem === "imovel"
              ? PORTO_EMBUTIDO_IMOVEL_PERCENTUAL
              : parseFloat(portoAutoPercEmbutidoInput) || 0;
          const maxEmbutidoReais = valorCreditoOriginal * maxEmbutidoPerc;
          const valorEmbutidoDigitado =
            parseFloat(dadosLanceInput.valorEmbutido) || 0;
          parteEmbutidaReais = Math.min(
            valorEmbutidoDigitado,
            maxEmbutidoReais
          );
        }

        if (tipoLanceSelecionado === "livre") {
          const valorLanceLivreReais =
            parseFloat(dadosLanceInput.valorLanceLivre) || 0;
          const percLanceLivre =
            parseFloat(dadosLanceInput.percentualLanceLivre) || 0;
          if (valorLanceLivreReais > 0) {
            partePropriaReais = valorLanceLivreReais;
          } else if (percLanceLivre > 0) {
            partePropriaReais = baseCalculoLance * (percLanceLivre / 100.0);
          }
        } else if (tipoLanceSelecionado.includes("fixo_porto")) {
          const valorTotalFixo = baseCalculoLance * PORTO_LANCE_FIXO_PERCENTUAL;
          partePropriaReais = valorTotalFixo - parteEmbutidaReais;
        }
      } else if (admin === "yamaha") {
        if (dadosLanceInput.usarEmbutido) {
          const maxEmbutidoPerc =
            tipoBem === "imovel"
              ? YAMAHA_EMBUTIDO_LIVRE_IMOVEL_CREDITO_PERCENTUAL
              : YAMAHA_EMBUTIDO_LIVRE_AUTO_CREDITO_PERCENTUAL;
          const maxEmbutidoReais = valorCreditoOriginal * maxEmbutidoPerc;
          const valorEmbutidoDigitado =
            parseFloat(dadosLanceInput.valorEmbutido) || 0;
          parteEmbutidaReais = Math.min(
            valorEmbutidoDigitado,
            maxEmbutidoReais
          );
        }

        if (tipoLanceSelecionado === "livre_yamaha") {
          const valorLanceLivreReais =
            parseFloat(dadosLanceInput.valorLanceLivre) || 0;
          const percLanceLivre =
            parseFloat(dadosLanceInput.percentualLanceLivre) || 0;
          if (valorLanceLivreReais > 0) {
            partePropriaReais = valorLanceLivreReais;
          } else if (percLanceLivre > 0) {
            partePropriaReais = baseCalculoLance * (percLanceLivre / 100.0);
          }
        } else if (tipoLanceSelecionado.includes("fixo_yamaha")) {
          const valorTotalFixo =
            baseCalculoLance *
            YAMAHA_LANCE_FIXO_IMOVEL_SALDO_DEVEDOR_PERCENTUAL;
          partePropriaReais = valorTotalFixo - parteEmbutidaReais;
        }
      } else if (admin === "itau") {
        const percProprio =
          parseFloat(dadosLanceInput.percentualLanceProprioItau) || 0;
        const percEmbutido =
          parseFloat(dadosLanceInput.percentualLanceEmbutidoItau) || 0;
        partePropriaReais = baseCalculoLance * (percProprio / 100.0);
        const percEmbutidoLimitado = Math.min(
          percEmbutido,
          ITAU_EMBUTIDO_MAX_PERCENTUAL * 100
        );
        parteEmbutidaReais = baseCalculoLance * (percEmbutidoLimitado / 100.0);
      }

      const valorTotalLance = partePropriaReais + parteEmbutidaReais;
      lanceCalculadoObj.valorCalculado = Math.max(0, valorTotalLance);
      lanceCalculadoObj.valorEmbutido = Math.max(0, parteEmbutidaReais);
      lanceCalculadoObj.valorDoBolso = Math.max(0, partePropriaReais);

      const baseDeCalculoFinalDoPercentual =
        admin === "itau" ? valorCreditoOriginal : saldoDevedorVigente;
      if (baseDeCalculoFinalDoPercentual > 0) {
        lanceCalculadoObj.percentualOfertado =
          (lanceCalculadoObj.valorCalculado / baseDeCalculoFinalDoPercentual) *
          100.0;
      }
    }

    // --- 6. RECÁLCULO PÓS-LANCE ---
    const creditoLiquidoAposEmbutido =
      valorCreditoOriginal - lanceCalculadoObj.valorEmbutido;
    let parcelaPosContemplacaoFinal = parcelaComRedutorCompleta;
    let prazoFinalResultado = prazoRestanteVigente;
    let parcelaPosLanceDetalhada = null;

    const parcelasPagas = Math.max(1, mesesPagosAntesLance);

    if (tipoLanceSelecionado !== "nenhum") {
      if (lanceCalculadoObj.formaAbatimento === "reduzir_valor_parcela") {
        const seguroTotalEstimado = seguroVidaMensalFixo * prazoTotalConsorcio;
        const saldoDevedorBruto = saldoDevedorOriginal + seguroTotalEstimado;
        const saldoAposLance =
          saldoDevedorBruto - lanceCalculadoObj.valorCalculado;

        // REGRA ATUALIZADA: Aplica lógica especial para IMÓVEL e para PORTO AUTOMÓVEL
        if (
          tipoBem === "imovel" ||
          (admin === "porto" && tipoBem === "automovel")
        ) {
          // LÓGICA ESPECIAL: Abate UMA parcela e 1 mês do prazo
          const saldoFinalParaDividir =
            saldoAposLance - parcelaComRedutorCompleta;
          prazoFinalResultado =
            prazoRestanteVigente > 1 ? prazoRestanteVigente - 1 : 1;
          parcelaPosContemplacaoFinal =
            prazoFinalResultado > 0
              ? saldoFinalParaDividir / prazoFinalResultado
              : 0;
        } else {
          prazoFinalResultado = prazoRestanteVigente;
          parcelaPosContemplacaoFinal =
            prazoFinalResultado > 0 ? saldoAposLance / prazoFinalResultado : 0;
        }
      } else if (lanceCalculadoObj.formaAbatimento === "reduzir_prazo_final") {
        parcelaPosContemplacaoFinal = parcelaOriginalCompleta;

        let numParcelasQuitadas = 0;
        if (parcelaOriginalCompleta > 0) {
          numParcelasQuitadas = Math.floor(
            lanceCalculadoObj.valorCalculado / parcelaOriginalCompleta
          );
        }

        const parcelasPagas = Math.max(1, mesesPagosAntesLance);
        prazoFinalResultado =
          prazoTotalConsorcio - parcelasPagas - numParcelasQuitadas;
      }
    }

    const round = (num) => parseFloat(num.toFixed(2));

    return {
      parcelaOriginal: round(parcelaOriginalCompleta),
      parcelaComRedutor: round(parcelaComRedutorCompleta),
      valorSeguroVidaMensalOriginal: round(seguroVidaMensalFixo),
      percentualRedutor: round(percentualRedutorAplicado),
      lance: {
        ...lanceCalculadoObj,
        valorCalculado: round(lanceCalculadoObj.valorCalculado),
        percentualOfertado: round(lanceCalculadoObj.percentualOfertado),
        valorEmbutido: round(lanceCalculadoObj.valorEmbutido),
        valorDoBolso: round(lanceCalculadoObj.valorDoBolso),
      },
      creditoLiquido: round(creditoLiquidoAposEmbutido),
      prazoComLance: prazoFinalResultado,
      parcelaPosContemplacao: round(parcelaPosContemplacaoFinal),
      adesaoMensal: round(adesaoMensal),
      mesesRestantesAdesao: mesesRestantesAdesao,
      parcelaPosLanceDetalhada:
        parcelaPosLanceDetalhada !== null
          ? round(parcelaPosLanceDetalhada)
          : null,
    };
  } catch (e) {
    console.error("Erro na simulação JavaScript:", e);
    return { erro: `Erro na simulação: ${e.message}`, traceback: e.stack };
  }
}

module.exports = { realizarCalculoSimulacao };
